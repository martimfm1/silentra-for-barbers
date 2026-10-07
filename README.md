# Silentra for Barbers

> SaaS multi-tenant da Silentra para gestão, agendamento e operações de barbearias, com experiência pública de booking e backoffice completo para equipas.

**Produção:** https://barbers.silentra.me

[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-635BFF?logo=stripe)](https://stripe.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployment-black?logo=vercel)](https://vercel.com/)
[![pnpm](https://img.shields.io/badge/pnpm-11.28.2-F69220?logo=pnpm)](https://pnpm.io/)

## O que é

O **Silentra for Barbers** é uma plataforma SaaS multi-tenant para digitalizar a operação de uma barbearia.

A experiência está dividida em duas superfícies:

- **Pública:** marketplace, páginas de barbearias, serviços, disponibilidade e booking.
- **Privada:** dashboard, agenda, clientes, equipa, marketing, mensagens, configurações e billing.

Regras de negócio, autorização, isolamento de tenants e entitlements são decididos no servidor. A UI não é uma fronteira de segurança.

## Funcionalidades

### Booking e experiência pública

- Marketplace público de barbearias.
- Pesquisa, filtros e localização.
- Perfil público da barbearia.
- Serviços, profissionais, horários e disponibilidade.
- Booking sem obrigar o cliente a criar uma conta.
- Bloqueios de agenda e dias fechados.
- Proteção contra reservas concorrentes/duplicadas.
- Customer portal e gestão de marcações através de tokens.
- Sistema de fidelização e validação de códigos.

### Gestão da barbearia

- Dashboard operacional.
- Agenda e marcações.
- Clientes.
- Serviços, preços e duração.
- Profissionais e permissões.
- Bloqueios de agenda.
- Analytics.
- Marketing e automações.
- Mensagens e comunicação por email.
- Push notifications.
- Configurações da barbearia.

### POS e marketplace

- Registo de vendas.
- Produtos e serviços.
- Stock e quantidades.
- Histórico, reembolsos e anulações.
- Catálogo público.
- Checkout de produtos.
- Validação server-side de preços, stock, produtos e entrega.
- Encomendas e estados de lifecycle.

### Comunicação

- Email transacional via Brevo.
- Templates com variáveis.
- Sender por barbearia.
- Marketing e automações.
- Workers/filas assíncronas.
- Push notifications.
- Suporte preparado para SMS.

## Planos

O acesso às funcionalidades é baseado em entitlements verificados no backend.

| Área | Free | Pro | Enterprise |
| --- | :---: | :---: | :---: |
| Marcações | ✓ | ✓ | ✓ |
| Clientes e serviços | ✓ | ✓ | ✓ |
| Profissionais | ✓ | ✓ | ✓ |
| Dashboard | ✓ | ✓ | ✓ |
| Funcionalidades avançadas | — | ✓ | ✓ |
| Marketing e automações | — | ✓ | ✓ |
| Analytics avançado | — | ✓ | ✓ |
| Funcionalidades Enterprise | — | — | ✓ |

Os contratos de planos são validados por QA e as APIs não devem confiar no estado enviado pelo cliente.

## Billing

O sistema suporta **Pagamento Manual** e **Stripe**.

- No modo Manual, pedidos guardam o preço/período no momento da criação.
- O administrador pode enviar/reenviar links de pagamento e ativar subscrições.
- Uma subscrição Manual continua Manual mesmo que o modo global mude.
- Uma subscrição Stripe continua Stripe mesmo que o modo global mude.
- Webhooks Stripe sincronizam apenas subscrições do provider Stripe.
- Preços e operações sensíveis são validados server-side.

Ver [docs/BILLING.md](docs/BILLING.md).

## Arquitetura

```text
Browser
  │
  ├── Public pages
  │     ├── Marketplace
  │     ├── Barbershop pages
  │     └── Booking
  │
  └── Authenticated dashboard
        │
        ▼
Next.js App Router
  │
  ├── Route Handlers / API
  ├── Server-side services
  ├── Authentication / authorization
  ├── Plan entitlements
  └── Integrations
        ├── Supabase Auth
        ├── PostgreSQL + RLS
        ├── Stripe
        ├── Brevo
        └── Web Push
```

**Regra de arquitetura:**

```
UI → API → service layer → database/provider
```

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

- Next.js 16.3.8 + App Router
- React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui + Radix UI
- TanStack Query
- Supabase PostgreSQL + Auth
- Stripe + billing manual
- Brevo
- Leaflet / React Leaflet
- Vercel Analytics + Speed Insights
- Vercel
- pnpm 11.28.2

## Estrutura

```text
app/
├── api/                     # APIs, webhooks e workers
├── barbershops/             # experiência pública
├── dashboard/               # área autenticada
├── marketplace/             # marketplace
├── checkout/                # checkout/billing
├── plans/                   # planos
├── silentrа-admin/          # administração da plataforma
└── ...

components/                  # componentes React
context/                     # providers/contextos
lib/                         # clientes e utilitários
services/                    # regras de negócio server-side
supabase/migrations/         # migrations PostgreSQL
scripts/                     # QA e manutenção
types/                       # tipos partilhados
.github/workflows/            # CI
```

## Desenvolvimento local

### Requisitos

- Node.js 22
- pnpm 11.28.2
- Projeto Supabase
- Stripe para billing
- Brevo para email
- Docker Desktop quando necessário para operações locais do Supabase CLI

### Instalação

```bash
pnpm install
```

Cria `.env.local` usando [.env.example](.env.example) como referência.

**Nunca commits secrets reais.**

### Desenvolvimento

```bash
pnpm dev
```

O projeto usa Webpack no script de desenvolvimento e build:

```text
next dev --webpack
next build --webpack
```

### Build

```bash
pnpm build
pnpm start
```

Ver [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Variáveis de ambiente

A referência canónica é [.env.example](.env.example).

Principais grupos:

| Grupo | Variáveis |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Stripe | `STRIPE_SECRET_KEY`, webhook secret e price IDs |
| Manual billing | `MANUAL_PRICE_*`, `MANUAL_PAYMENT_ALLOWED_HOSTS` |
| Brevo | `BREVO_API_KEY`, sender e webhook secret |
| Workers | `CRON_SECRET` |
| Abuse protection | `RATE_LIMIT_SECRET` |
| App | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` |
| Storage opcional | `AWS_*` |

Secrets server-side nunca devem usar `NEXT_PUBLIC_`.

## Supabase

As alterações de schema vivem em `supabase/migrations`.

Regras:

1. Não editar migrations já aplicadas em produção.
2. Resolver divergências de migration history antes de operações destrutivas.
3. Rever RLS e policies em cada alteração de dados.
4. RPCs privilegiadas devem validar o contexto autorizado.
5. Service-role credentials ficam exclusivamente server-side.

## Segurança

O projeto utiliza:

- Supabase Auth.
- PostgreSQL Row Level Security.
- Isolamento multi-tenant.
- Autorização server-side.
- Entitlements server-side.
- Rate limiting em fluxos públicos sensíveis.
- Validação de Stripe webhooks.
- `CRON_SECRET` para workers.
- Headers de segurança.
- Auditorias automáticas de API, dependências e segurança.

### Política de embeds

A intenção é permitir que **páginas públicas** sejam integradas em sites como Silentra e Whop, sem transformar áreas privadas em superfícies iframe.

```text
Páginas públicas
  → embed permitido

Login / recuperação / onboarding
  → embed bloqueado

Dashboard / billing / checkout / admin
  → embed bloqueado

API
  → não é superfície de iframe
```

Ver [docs/SECURITY.md](docs/SECURITY.md).

## Quality Assurance

Comandos principais:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm qa:api
pnpm qa:plans
pnpm qa:security
pnpm qa:deps
pnpm qa:copy
pnpm qa:product
pnpm qa:manual-payments
pnpm format:check
pnpm qa
```

Smoke QA:

```bash
pnpm start
pnpm qa:smoke
```

O `pnpm qa` executa typecheck, lint, build e os contratos/auditorias principais.

## Deploy

O projeto está preparado para Vercel.

Antes de produção:

- CI sem falhas.
- Env vars configuradas.
- Migrations aplicadas e verificadas.
- Stripe webhooks ativos.
- Brevo configurado.
- Secrets de workers configurados.
- Cron/workers operacionais.
- Domínio e URLs corretos.
- Smoke tests dos fluxos críticos.

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Arquitetura, camadas e isolamento multi-tenant |
| [Development](docs/DEVELOPMENT.md) | Setup local, env e workflow |
| [Billing](docs/BILLING.md) | Stripe e pagamentos manuais |
| [Security](docs/SECURITY.md) | Segurança, auth, RLS, APIs e embeds |
| [Deployment](docs/DEPLOYMENT.md) | Release, Vercel, Supabase e produção |

## Estado do projeto

O Silentra for Barbers está em desenvolvimento ativo e em fase de hardening para produção.

Uma funcionalidade só deve ser considerada concluída quando UI, backend, autorização, isolamento de tenant, estados de erro e QA estiverem corretos.

## Licença

O repositório é privado e propriedade da Silentra. Na ausência de um ficheiro `LICENSE`, não é concedida uma licença open-source por defeito.
