# Silentra for Barbers

> SaaS multi-tenant de gestão, agendamento e operações para barbearias, com experiência pública para clientes e ferramentas de gestão para equipas.

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-635bff?logo=stripe)](https://stripe.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss)](https://tailwindcss.com/)

## Sobre o projeto

O Silentra for Barbers é uma plataforma web multi-tenant para barbearias. O produto liga a experiência pública de descoberta e marcação à operação diária da barbearia num único sistema.

A plataforma foi desenhada para manter uma separação clara entre:

```text
Cliente → páginas públicas / booking / customer portal
Barbearia → dashboard / agenda / clientes / equipa / POS / marketing
Backend → APIs / regras de negócio / Supabase / Stripe / Brevo
```

A autorização, o isolamento de tenants e os entitlements dos planos são tratados no servidor. A UI nunca é considerada a camada de segurança.

## Funcionalidades

### Experiência pública e cliente

- Marketplace público de barbearias.
- Pesquisa, filtros e localização.
- Perfil público da barbearia e página pública de vendas.
- Marcação sem obrigar o cliente a criar uma conta.
- Seleção de serviço, profissional, data e horário.
- Disponibilidade calculada a partir da agenda e dos bloqueios.
- Dias fechados protegidos no frontend e no backend.
- Proteção contra marcações duplicadas/concorrentes no fluxo de reserva.
- Customer portal com próxima marcação e acesso a detalhes.
- Gestão segura de marcações através de tokens.
- Sistema de fidelização e validação de códigos.

### Dashboard da barbearia

- Início com visão operacional.
- Agenda e gestão de marcações.
- Clientes.
- Serviços, preços e duração.
- Profissionais e permissões.
- Bloqueios de agenda.
- Analytics e estatísticas.
- Marketing e automações.
- Comunicação manual por email.
- Notificações push para a equipa.
- Configurações da barbearia.
- Billing e gestão da subscrição.

### POS e vendas

- Registo de vendas.
- Catálogo de produtos e serviços.
- Controlo de quantidade e stock.
- Pesquisa/seleção de cliente quando aplicável.
- Histórico de vendas.
- Reembolso e anulação.
- Repetição rápida de uma venda concluída usando os dados atuais do catálogo.
- Validação server-side de preços e stock antes de concluir a operação.

### Marketplace e encomendas

- Catálogo público de produtos.
- Checkout para produtos.
- Validação server-side de loja, produtos, quantidades e entrega.
- Criação atómica de encomendas.
- Estados de encomenda rastreáveis.
- Histórico de transições através de eventos de lifecycle.
- Notificações/transporte preparados para os diferentes estados operacionais.

### Comunicação e automações

- Email transacional através da Brevo.
- Templates com variáveis do cliente e da barbearia.
- Sender baseado na configuração da barbearia.
- Campanhas e automações de marketing.
- Filas para processamento assíncrono.
- Push notifications para eventos operacionais.
- SMS preparado para futura ativação quando o fornecedor estiver configurado.

## Planos SaaS

O acesso às funcionalidades e quotas é definido pelos entitlements no backend.

| Área                       | Free | Pro | Enterprise |
| -------------------------- | :--: | :-: | :--------: |
| Gestão de marcações        |  ✓   |  ✓  |     ✓      |
| Clientes e serviços        |  ✓   |  ✓  |     ✓      |
| Gestão de profissionais    |  ✓   |  ✓  |     ✓      |
| Dashboard operacional      |  ✓   |  ✓  |     ✓      |
| Funcionalidades avançadas  |  —   |  ✓  |     ✓      |
| Marketing e automações     |  —   |  ✓  |     ✓      |
| Analytics avançado         |  —   |  ✓  |     ✓      |
| Funcionalidades Enterprise |  —   |  —  |     ✓      |

As quotas e os entitlements efetivos são definidos no código e validados pelas APIs. A interface adapta-se ao plano atual, mas não é utilizada como mecanismo de segurança.

## Billing

A faturação suporta dois métodos globais: **Pagamento Manual** e **Stripe**.

- O modo inicial é **MANUAL** e pode ser alterado pelo painel administrativo sem deploy.
- No modo Manual, uma nova subscrição cria um pedido com preço e período guardados no momento da criação.
- O administrador pode enviar/reenviar um link de pagamento, confirmar o pagamento e ativar a subscrição.
- Renovações manuais reutilizam a mesma conta e mantêm o histórico dos pedidos.
- Um pedido manual não cria Customers, Checkout Sessions ou Subscriptions na Stripe.
- No modo Stripe, o fluxo Stripe existente continua a tratar novas subscrições.
- Uma subscrição Stripe existente continua Stripe mesmo que o modo global passe para Manual.
- Uma subscrição Manual existente continua Manual mesmo que o modo global passe para Stripe.
- Eventos Stripe continuam a sincronizar apenas subscrições associadas ao provider Stripe.

## Segurança e arquitetura

A aplicação utiliza uma arquitetura multi-tenant com autorização server-side.

- **Supabase Auth** para autenticação.
- **PostgreSQL + Row Level Security (RLS)** para isolamento dos dados.
- Cliente administrativo do Supabase apenas em código server-side.
- APIs com verificação de identidade e tenant.
- Entitlements de planos verificados no backend.
- Permissões de staff separadas das permissões de plano.
- Rate limiting para fluxos públicos sensíveis.
- Webhooks Stripe validados server-side.
- Workers/cron protegidos por `CRON_SECRET`.
- Segredos nunca devem ser expostos através de variáveis `NEXT_PUBLIC_*`.
- Headers de segurança configurados no Next.js.
- Auditoria estática de APIs e segurança integrada na CI.

## Stack

- **Framework:** Next.js 16.3, App Router
- **Linguagem:** TypeScript
- **UI:** React, Tailwind CSS, shadcn/ui, Radix UI, Lucide
- **Data fetching/state:** TanStack Query
- **Backend:** Next.js Route Handlers + serviços server-side
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth
- **Billing:** Stripe
- **Email:** Brevo
- **Push:** Web Push
- **Maps:** Leaflet / React Leaflet
- **Analytics:** Vercel Analytics + Speed Insights

## Estrutura do projeto

```text
app/
├── api/                     # APIs, webhooks e workers HTTP
├── barbershops/             # marketplace e experiência pública
├── dashboard/               # área autenticada da barbearia
├── marketplace/             # fluxos públicos de marketplace/checkout
├── checkout/                # estados de checkout/billing
├── plans/                   # apresentação pública dos planos
└── ...

components/                 # componentes React reutilizáveis
context/                     # providers de contexto
lib/                         # auth, Supabase, Stripe, email, segurança e utilitários
services/                    # regras de negócio e serviços server-side
supabase/
├── migrations/              # migrações PostgreSQL versionadas
└── ...
scripts/                    # QA, manutenção e automações
types/                       # tipos partilhados
.github/workflows/            # CI e jobs operacionais
```

## Desenvolvimento local

### Requisitos

- Node.js 22.
- pnpm 11.28.2.
- Conta Supabase para database e autenticação.
- Stripe para testar billing.
- Brevo para testar email.
- Docker Desktop apenas quando forem necessárias operações locais do Supabase CLI que utilizem shadow database.

### Instalação

```bash
pnpm install
```

Cria `.env.local` com os valores do teu ambiente. Usa `.env.example` como referência e nunca comitas secrets reais.

### Desenvolvimento

```bash
pnpm dev
```

### Build de produção local

```bash
pnpm build
pnpm start
```

## Quality assurance

A repository inclui verificações automáticas para reduzir regressões antes de um release.

```bash
pnpm typecheck
pnpm lint
pnpm qa:api
pnpm qa:plans
pnpm qa:security
pnpm qa:deps
pnpm qa:copy
pnpm qa:product
pnpm format:check
pnpm build
```

Ou executar a sequência principal:

```bash
pnpm qa
```

Também existe smoke QA contra um servidor de produção local:

```bash
pnpm start
pnpm qa:smoke
```

A CI executa typecheck, lint, auditorias de API/segurança/dependências, contratos de planos/produto, formatting, build e smoke QA. A validação de secrets de produção (`pnpm qa:env`) é executada separadamente porque requer valores reais do ambiente de produção.

## Supabase

As alterações de schema são versionadas em `supabase/migrations`.

Antes de aplicar migrations num ambiente remoto:

1. Confirma o estado da migration history local e remota.
2. Não edites retroativamente migrations que já tenham sido aplicadas em produção.
3. Resolve discrepâncias de migrations antes de executar comandos destrutivos.
4. Confirma RLS, policies e funções RPC associadas a cada alteração de dados.

A lógica crítica de reservas, stock, encomendas, billing e outros fluxos sensíveis deve permanecer protegida no servidor/database e não apenas na UI.

## Variáveis de ambiente

Consulta `.env.example` para a lista atualizada. As principais variáveis são:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_YEARLY_PRICE_ID=
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=
STRIPE_ENTERPRISE_YEARLY_PRICE_ID=
STRIPE_BILLING_PORTAL_CONFIGURATION_ID=

BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=Silentra
BREVO_WEBHOOK_SECRET=
BREVO_SMS_SENDER=

CRON_SECRET=
RATE_LIMIT_SECRET=

NEXT_PUBLIC_APP_URL=https://barbers.silentra.me
NEXT_PUBLIC_SITE_URL=https://barbers.silentra.me
QA_BASE_URL=http://127.0.0.1:3000
```

As integrações opcionais de storage podem utilizar:

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

Nunca coloques chaves privadas, tokens, passwords ou secrets no repositório.

## Cron e workers

Existem workers protegidos para tarefas como:

- processamento de marketing;
- automações;
- conclusão automática de marcações;
- filas de emails/notificações.

O endpoint de cada worker valida `CRON_SECRET`. A execução agendada deve ser configurada no ambiente escolhido e monitorizada; uma chamada manual/autenticada não substitui o scheduler de produção.

## Deploy e release

O projeto está preparado para deploy em Vercel.

Antes de promover uma versão para produção, confirma pelo menos:

```text
1. CI sem falhas.
2. Dependências sem vulnerabilidades High/Critical bloqueadoras.
3. Variáveis de ambiente de produção configuradas.
4. Migrations Supabase aplicadas e validadas.
5. Stripe webhooks ativos e verificados.
6. Brevo configurado e sender validado.
7. CRON_SECRET e RATE_LIMIT_SECRET configurados.
8. Cron/workers com scheduler operacional.
9. Domínio e URLs públicas corretos.
10. Smoke test de booking, login, dashboard, billing e checkout.
```

Não considerar um release pronto apenas porque o build terminou. Os fluxos críticos devem ser validados ponta a ponta.

## Estado do projeto

O Silentra for Barbers encontra-se em desenvolvimento ativo e em fase de hardening para produção. A base funcional, segurança server-side, contratos de produto e infraestrutura de QA estão implementados, mas uma release de produção só deve ser promovida depois de a CI final passar e das integrações externas terem sido verificadas no ambiente real.

A regra de ouro para alterações sensíveis é:

```text
UI → API → service layer → Supabase / Stripe / Brevo
```

Uma funcionalidade só está concluída quando o fluxo completo, a autorização, os dados e os estados de erro estão corretos.

## Documentação legal

A aplicação disponibiliza Termos de Serviço e Política de Privacidade para o modelo SaaS. A documentação legal deve ser revista juridicamente antes de uma utilização comercial definitiva.

## Licença

O código deste repositório é disponibilizado de acordo com os termos definidos pelo proprietário do projeto. Na ausência de um ficheiro `LICENSE`, não é concedida qualquer licença open-source por defeito.
