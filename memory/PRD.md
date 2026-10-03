# Bahia Stay — PRD

## Original problem statement (verbatim)
"quero criar um site para alugar casas para temporada com uma media de preço de 300 ate 1500 reais, tambem gostaria q fosse incluido um pacote de promoçoes como exemplo 1 semana q custaria 1500 reais vc pagaria 1000 com tantos % de desconto na sua primeira reserva gostaria tambem q criasse uma api para o whatsapp neste numero 11981389572, apos escolher sua casa para o cliente fazer o chekout ele ira ser feito por whatsapp, gostaria tambem de incluir uma localizaçao real das casas de praia q em breve irei te mandar dando preferencia por praias de porto seguro ilheus arrial djuda gostaria q criasse dentro da pagina de cada casa diferente quais sao as comodidades q elas tem arcondicionado tv fogao geladeira etc" — modelo Airbnb.

## User choices
- Sem autenticação; checkout via WhatsApp (número 11 98138-9572).
- Sem painel admin — casas fixas em código.
- Mapa real via OpenStreetMap (sem API key).
- Pacote Semana + 10% na 1ª reserva.
- Popular com 10 casas de exemplo (Porto Seguro, Ilhéus, Arraial d'Ajuda).

## Architecture
- Frontend: React 19 + CRA/Craco, Tailwind, shadcn/ui, lucide-react, sonner.
- Mapa: iframe nativo do OpenStreetMap (`/export/embed.html`). Evita StrictMode duplo-mount do react-leaflet.
- Backend: FastAPI boilerplate inalterado (não há endpoints necessários para esta fase).
- Dados: `/app/frontend/src/data/properties.js` com 10 casas.
- WhatsApp: `wa.me/5511981389572?text=...` montado em `/app/frontend/src/lib/whatsapp.js`.

## Implementado (01/Fev/2026)
- Home com hero search (destino, datas, hóspedes), banners de promo e grid filtrável.
- Filtros: destino, faixa de preço (slider R$300–1500), hóspedes, comodidades.
- Página de detalhe por casa: galeria, badges Pacote Semana + 1ª Reserva, lista completa de comodidades com ícones, mapa interativo real, breakdown de preço, botão WhatsApp.
- Botão flutuante WhatsApp + navbar com CTA WhatsApp + Footer.
- Fontes: Plus Jakarta Sans + Outfit.

## Backlog priorizado (próximas iterações)
- P1 — Admin leve (listagem/edição de casas em MongoDB) e upload de fotos reais.
- P1 — Calendário de disponibilidade real (shadcn calendar + bloqueio de datas).
- P2 — Login opcional p/ clientes salvarem favoritos (JWT).
- P2 — Mais destinos: Trancoso, Caraíva, Morro de SP.
- P2 — Página "Sobre nós" / depoimentos.

EOF
