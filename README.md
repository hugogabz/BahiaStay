# Bahia Stay

Catálogo de casas de temporada com filtros, fotos, localização, calendário e orçamento. Este projeto é destinado a testes e apresentação, sem vendas ou cobranças reais.

## Aplicação

- `frontend`: React com CRACO. Execute `npm install` e `npm start`; `npm run build` gera a versão de produção.
- `backend`: FastAPI com Neon/PostgreSQL; MongoDB é mantido no desenvolvimento local durante a transição. Instale `backend/requirements.txt` e execute `uvicorn server:app` dentro de `backend`.
- Testes da interface: `npm test -- --watchAll=false --runInBand` em `frontend`.
- Testes autenticados da API usam `TEST_ADMIN_EMAIL` e `TEST_ADMIN_PASSWORD`, definidos no ambiente.

O backend precisa de `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `CORS_ORIGINS`. Use `DATABASE_URL` para Neon/PostgreSQL; no desenvolvimento com MongoDB, use `MONGO_URL` e `DB_NAME`. Configure `REACT_APP_BACKEND_URL` no frontend para apontar à API. Configure as credenciais de armazenamento e pagamento apenas no ambiente que utiliza essas integrações.

## Catálogo e tarifas

Fotos, descrições e tarifas são editáveis no painel. O orçamento considera as noites ocupadas, o pacote semanal e os acréscimos configurados por imóvel: inicialmente +40% de 20 de dezembro a 10 de janeiro e +20% em julho.

`backend/seed_properties.json` fornece os dados de um banco novo; alterar esse arquivo não atualiza um banco existente. `backend/catalog_pricing_updates.json` registra os preços e períodos bloqueados preparados nesta versão, para revisão e aplicação nos imóveis correspondentes do ambiente de destino. Os bloqueios são exemplos autorizados para apresentação e devem ser substituídos pelas reservas reais antes de usar o calendário com clientes.

O catálogo contém 57 imóveis. Os 30 novos anúncios foram consultados no Airbnb: fotos de cada imóvel, capacidade, comodidades, anfitrião e coordenadas públicas. Suas 150 fotos foram hospedadas no Cloudinary, sem reutilizar as galerias anteriores. `backend/catalog_sources.json` registra a fonte e as fotos correspondentes de cada anúncio. As coordenadas podem ser aproximadas, como no Airbnb. A consulta não retornou diárias confirmadas. Por autorização do usuário, os 30 novos anúncios usam diárias fictícias entre R$ 180 e R$ 530, com pacote semanal promocional equivalente a seis diárias e ajustes de +40% no Réveillon e +20% em julho. Esses valores não são preços informados pelo Airbnb; sua origem de teste está registrada no catálogo.

Por autorização do usuário, cada novo imóvel contém três comentários fictícios identificados como ilustrativos e dois períodos bloqueados de exemplo. Os comentários são separados das notas agregadas consultadas no Airbnb. Não há sincronização de reservas entre o site e o Airbnb. Em um banco Neon existente, `python backend/migrate_catalog.py` adiciona os IDs ausentes sem sobrescrever imóveis editados.

As 105 fotos do catálogo inicial estão no Cloudinary, com links HTTPS no arquivo de seed. O banco local não é enviado pelo Git; um banco existente precisa receber a atualização do catálogo explicitamente. O upload de novas fotos pelo painel ainda utiliza o serviço de armazenamento configurado no backend. O GitHub guarda o código; interface, API e banco precisam de hospedagem e variáveis de ambiente configuradas no ambiente do dono.

## Enviar alterações

O repositório de hospedagem é `hugogabz/BahiaStay`, na branch `main`. Conecte essa branch à Vercel para as atualizações deste projeto. O repositório original `fonsecawork26-cmd/Airbnb` continua independente: contribuições para ele devem ser enviadas por pull request e não são sincronizadas automaticamente. Não envie arquivos `.env`, senhas, registros de execução, banco local, dependências ou ferramentas instaladas neste computador.

## Hospedagem e pagamentos

Veja [DEPLOYMENT.md](DEPLOYMENT.md) para configurar os dois projetos na Vercel e o banco Neon. O PIX Coldpayments foi preparado com testes simulados e permanece desativado até a confirmação de sandbox.
