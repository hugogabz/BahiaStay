# Publicação na Vercel com Neon

O projeto tem dois serviços: frontend React e API FastAPI. As fotos do catálogo já estão no Cloudinary. O PIX Coldpayments está preparado e foi validado com respostas simuladas; permanece desativado.

## Banco

Na Vercel, adicione Neon em Storage e crie o banco. Cadastre a conexão PostgreSQL com pooling e TLS na variável DATABASE_URL do projeto da API. Nunca coloque o valor no Git ou no frontend.

Com DATABASE_URL configurada, a API usa PostgreSQL. Sem essa variável, o desenvolvimento local continua usando o MongoDB já existente. Os documentos são armazenados em tabelas JSONB com índices e consultas parametrizadas.

Uma API conectada a banco vazio importa automaticamente os 57 imóveis de backend/seed_properties.json. Para importar em um banco que já possui catálogo, execute `python backend/migrate_catalog.py`: os IDs existentes são preservados. A importação não transfere senhas nem reservas do banco local. Os 30 novos anúncios têm fontes públicas do Airbnb registradas em backend/catalog_sources.json e fotos próprias hospedadas no Cloudinary. Seus bloqueios e comentários ilustrativos são exemplos autorizados para apresentação. O site é destinado a testes, sem vendas. As diárias dos 30 novos anúncios são fictícias e autorizadas pelo usuário (R$ 180 a R$ 530), com ajustes sazonais; não são preços do Airbnb. Não conecte esse catálogo a cobranças reais.

## API

Crie um projeto Vercel com Root Directory `backend` e framework FastAPI. Use backend/.env.example como lista de variáveis. Defina JWT_SECRET aleatória, o login e a senha privados do administrador, FRONTEND_URL e CORS_ORIGINS com a URL exata do frontend.

## Frontend

Crie outro projeto com Root Directory `frontend`, framework Create React App, comando `yarn build` e saída `build`. Defina REACT_APP_BACKEND_URL com a URL HTTPS da API e publique novamente depois de alterar essa variável. Nenhuma chave secreta deve usar o prefixo REACT_APP_.

Importe `https://github.com/hugogabz/BahiaStay`, branch de produção `main`, na conta Vercel do usuário. Crie os dois projetos a partir desse mesmo repositório, usando as respectivas pastas raiz. O repositório original do dono permanece separado e não é atualizado automaticamente por essa publicação.

## Pagamentos

PAYMENT_PROVIDER está definido como coldpay e PAYMENTS_ENABLED como false. A integração segue https://coldpayments.com/docs: POST /payments com PIX, X-API-Key e X-Idempotency-Key; GET /payments/:id; webhook HMAC-SHA256 sobre timestamp + ponto + corpo bruto, com tolerância de cinco minutos. A confirmação verifica o valor e consulta a cobrança no gateway antes de aprovar a reserva. O total é calculado na API, incluindo temporadas. A documentação limita cada PIX a R$ 2.000,00; valores maiores não geram cobrança.

A documentação consultada só apresenta a API de produção. Não há sandbox confirmado. Não habilite cobranças nem use uma chave de produção para testes. Solicite ao provedor URL, credenciais e instruções de um ambiente sem movimentação real. Depois, configure privadamente COLDPAYMENTS_API_BASE_URL, COLDPAYMENTS_API_KEY e COLDPAYMENTS_WEBHOOK_SECRET; a chave só precisa dos escopos payments:read e payments:write. A URL do webhook é https://URL-DA-API/api/coldpayments/webhook. COLDPAYMENTS_SANDBOX_CONFIRMED=true e PAYMENTS_ENABLED=true só devem ser definidos após essa confirmação. O código bloqueia o host de produção e redirecionamentos HTTP.

Quando configurado, o frontend apresenta QR Code, copia e cola e acompanha a confirmação. Sem configuração, o botão de teste fica oculto. Cartões via Coldpayments não estão implementados. O Stripe antigo continua protegido e não é ativado pela configuração Coldpay.

Antes de habilitar pagamentos reais será necessário validar o fluxo completo no ambiente do provedor, definir a política de reservas pendentes/expiração, cancelamentos e reembolsos e revisar a concorrência de reservas. Os testes simulados não substituem essa validação. Reservas de teste que falharem podem ser removidas no painel administrativo para liberar as datas.

Não há credenciais Coldpay nem conexão Neon incluídas neste repositório. A validação de publicação, banco e pagamento externo só pode ser concluída depois da configuração dessas contas.

## Verificação

Execute `python -m unittest discover -s backend/tests -p "test_*.py"` com as dependências instaladas e configuração local de teste. No frontend: `yarn test --watchAll=false --runInBand` e `yarn build`. Depois da publicação, confira catálogo, autenticação, edição, galeria e checkout de sandbox no endereço público.

## Sessão administrativa

O login retorna apenas os dados públicos do administrador. O token fica em cookie HttpOnly, host-only, com Secure em HTTPS; não é salvo em localStorage nem aceito como Bearer. Tokens antigos no localStorage são removidos ao abrir o site. Login, logout e gravações administrativas exigem origem explícita em CORS_ORIGINS/FRONTEND_URL e o cabeçalho X-CSRF-Protection: 1, enviado pela interface. Não use wildcard nas origens.

O desenvolvimento HTTP é permitido apenas em localhost/127.0.0.1/::1, com cookie SameSite=Lax. Em HTTPS, o padrão SameSite=None permite os dois projetos separados. Navegadores que bloqueiam cookies de terceiros podem impedir esse fluxo: prefira servir a API via proxy /api no domínio do frontend (ou domínios próprios no mesmo site), usando AUTH_COOKIE_SAMESITE=lax. A configuração do proxy depende da URL final da API. Nunca volte a armazenar o token no frontend para contornar essa restrição.

A sessão expira em sete dias. O logout limpa o cookie no navegador; não revoga uma cópia do JWT previamente roubada. Use uma senha administrativa forte antes de publicar e valide a sessão no endereço público. A troca de armazenamento não substitui uma auditoria de segurança completa.
