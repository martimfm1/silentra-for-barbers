# Desenvolvimento

## Requisitos

- Node.js 22
- pnpm 11.28.2
- Supabase
- Stripe para billing
- Brevo para email
- Docker Desktop quando necessário para Supabase CLI

## Instalação

```bash
pnpm install
```

Cria `.env.local` a partir de [.env.example](../.env.example). Nunca coloques secrets reais no Git.

## Scripts

### Desenvolvimento

```bash
pnpm dev
```

### Build

```bash
pnpm build
pnpm start
```

### Tipos e lint

```bash
pnpm typecheck
pnpm lint
```

### QA

```bash
pnpm qa
```

QA individual:

```bash
pnpm qa:api
pnpm qa:plans
pnpm qa:security
pnpm qa:deps
pnpm qa:copy
pnpm qa:product
pnpm qa:manual-payments
pnpm format:check
```

Smoke test:

```bash
pnpm start
pnpm qa:smoke
```

## Workflow

1. Criar branch a partir de `main`.
2. Implementar a alteração.
3. Executar typecheck e lint.
4. Executar QA relevante.
5. Executar `pnpm qa`.
6. Rever alterações sensíveis.
7. Abrir PR com descrição do impacto.

## Migrations

As migrations ficam em `supabase/migrations`. Nunca reescrevas uma migration já aplicada em produção; cria uma nova migration.

Antes de alterações destrutivas confirma migration history, RLS/policies e dependências.

## Segurança durante desenvolvimento

Não imprimir tokens, colocar service-role keys em código client, criar `NEXT_PUBLIC_*` para secrets, confiar em IDs enviados pelo browser, desativar RLS para contornar problemas ou ignorar falhas de auditoria.
