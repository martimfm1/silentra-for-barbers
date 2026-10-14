# API pública — Silentra for Barbers

A API pública v1 permite integrar dados públicos de uma barbearia em websites, aplicações e diretórios. Não requer autenticação nem API key: só disponibiliza dados destinados a publicação na página pública da barbearia.

## Endpoint

GET https://barbers.silentra.me/api/v1/public/barbershops/{slug}

O slug é o identificador público atual da barbearia. Os slugs personalizados são resolvidos pelo mesmo serviço do perfil público. Slugs inválidos devolvem 400; perfis privados, desativados ou inexistentes devolvem 404.

## Exemplo

curl -i https://barbers.silentra.me/api/v1/public/barbershops/barbearia-exemplo

A resposta 200 inclui apiVersion, data.barbershop, data.services, data.reviews, data.rating, data.reviewsCount, data.bookingUrl e data.landingPage.

- barbershop: nome, slug, cidade, morada, telefone, imagens, tags, SEO, comodidades e horário público.
- services: ID público do serviço, nome, preço em EUR, duração em minutos e indicação pública de popularidade.
- reviews: até 100 avaliações recentes, com nome apresentado publicamente, classificação, comentário e data. reviewsCount e rating usam os agregados guardados da barbearia quando disponíveis.
- landingPage: inclui available=true e URL absoluta quando a barbearia tem Enterprise ativo; caso contrário, available=false e url=null.
- bookingUrl: URL absoluta do perfil público onde o cliente pode consultar detalhes e fazer a marcação.

A API não devolve email do proprietário, IDs de utilizadores, dados de faturação, tokens privados, clientes, marcações, notas internas ou chaves de integração.

## Cache e limites

- Cache público CDN: s-maxage=60, com stale-while-revalidate=300.
- ETag SHA-256 e pedidos condicionais If-None-Match; uma representação inalterada devolve 304 Not Modified.
- CORS: Access-Control-Allow-Origin: * para leitura pública sem credenciais. Não são permitidos cookies nem credenciais CORS.
- Limite inicial: 120 pedidos por minuto por IP, endpoint e slug. 429 inclui Retry-After.
- A API falha fechada com 503 se o serviço partilhado de rate limit estiver indisponível em produção.
- X-API-Version: 1 identifica a versão do contrato.

Erros são devolvidos em JSON com a propriedade error. Respostas de erro não são armazenadas em cache, exceto o 404 por um máximo de 30 segundos.

## OpenAPI

A especificação OpenAPI está disponível no ficheiro public/openapi-v1.yaml e, após deploy, em https://barbers.silentra.me/openapi-v1.yaml.

## Landing page Enterprise

A landing page é provisionada pelo backend quando o plano efetivo da barbearia passa a Enterprise, independentemente de a ativação ter origem em Stripe, pagamento manual ou atribuição administrativa. A página é renderizada a partir do perfil público e do catálogo de serviços existente, evitando duplicação de dados.

A plataforma mantém um único entitlement por barbearia. Ao terminar ou descer do plano Enterprise, o entitlement é suspenso. A página e a API só a anunciam quando o plano efetivo e o estado do entitlement continuam ativos. A migration faz também backfill para clientes Enterprise atuais. Não é executada nenhuma alteração à subscrição ou cobrança para ativar esta funcionalidade.

## Operação e rollout

1. Rever a migration 20261014230000_enterprise_landing_pages_public_api.sql.
2. Aplicar e verificar a migration no Supabase através do pipeline de migrations autorizado.
3. Fazer deploy da versão que contém a nova rota e landing page.
4. Executar pnpm qa:enterprise-landing-pages, pnpm qa:api, pnpm qa:plans e smoke tests.
5. Confirmar com uma barbearia Enterprise de teste que /site/{slug} está publicada e landingPage.available é true; testar também Free/Pro e downgrade/cancelamento.

A API é pública por desenho; este contrato não expõe endpoints de gestão ou edição da landing page.
