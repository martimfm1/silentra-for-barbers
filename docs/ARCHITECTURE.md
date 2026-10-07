# Arquitetura

## Objetivo

O Silentra for Barbers é uma aplicação Next.js multi-tenant. Cada operação deve respeitar o contexto da barbearia, o utilizador autenticado e os entitlements do plano.

## Camadas

```text
UI / Client Components
        │
        ▼
Next.js Route Handlers / Server Actions
        │
        ▼
Services / domain logic
        │
        ├── Supabase
        ├── Stripe
        ├── Brevo
        └── Web Push
```

A UI apresenta estado e recolhe input, mas não é responsável por decidir se uma operação é autorizada.

## Multi-tenancy

O contexto de tenant deve ser obtido e validado server-side.

Um endpoint que recebe um `barbershopId`, `tenantId`, recurso ou identificador semelhante do cliente não deve assumir que esse valor é autorizado.

Fluxo esperado:

1. Identificar o utilizador/sessão.
2. Resolver o tenant autorizado.
3. Verificar role/permissões.
4. Verificar entitlement quando necessário.
5. Validar o input.
6. Executar através do service/database layer.
7. Devolver apenas dados autorizados.

## Supabase

O PostgreSQL é a fonte de verdade para os dados persistentes. RLS é uma camada essencial de isolamento. Operações privilegiadas através de service role ficam server-side e devem ter verificações próprias.

## API

Route Handlers devem validar autenticação, tenant, permissões e input; aplicar rate limiting em endpoints públicos sensíveis; nunca confiar em IDs, preços, roles ou entitlements enviados pelo browser; e devolver erros controlados sem expor secrets.

## Billing

Billing tem duas superfícies independentes: provider manual e Stripe. Uma subscrição existente mantém o provider que lhe foi atribuído. Alterar o modo global não deve migrar silenciosamente subscrições existentes.

## Background jobs

Workers e cron endpoints são protegidos por `CRON_SECRET`. Operações idempotentes são preferíveis porque schedulers e retries podem repetir execuções.

## Princípio

```text
Never trust the client.
Resolve → authorize → validate → execute → audit
```
