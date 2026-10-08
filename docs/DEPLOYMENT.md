# Deployment

## Plataforma

O projeto está preparado para **Vercel** e utiliza Supabase como backend de dados/auth.

## Antes do deploy

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm qa
```

Para billing:

```bash
pnpm qa:manual-payments
pnpm qa:security
```

## Environment

Configura as variáveis de produção a partir de [.env.example](../.env.example).

Verifica especialmente Supabase, Stripe, manual billing, Brevo, `CRON_SECRET`, `RATE_LIMIT_SECRET` e URLs públicas.

## Supabase

Antes de promover migrations:

1. Rever SQL.
2. Confirmar RLS/policies.
3. Confirmar migration history.
4. Aplicar migrations.
5. Validar funções/RPCs.
6. Testar os fluxos dependentes.

## Stripe

Antes de produção confirma webhook endpoint, signing secret, products/prices, Customer Portal quando usado, URLs de retorno e eventos críticos.

## Brevo

Confirma API key, sender, templates, webhook secret quando aplicável e domínio/sender autorizado.

## Vercel

O deployment deve usar as variáveis do ambiente correto.

Depois do deploy:

1. Testar páginas públicas.
2. Testar booking.
3. Testar login.
4. Testar dashboard.
5. Testar billing.
6. Testar checkout.
7. Verificar security headers.
8. Verificar logs.
9. Executar smoke QA quando aplicável.

## Rollback

Um rollback de aplicação não desfaz automaticamente uma migration de database. Em caso de regressão, reverte para a última versão estável, verifica o estado de DB/providers e corrige a causa antes de nova promoção.
