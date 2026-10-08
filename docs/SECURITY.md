# Security

## Modelo

```text
Authentication
      ↓
Authorization
      ↓
Tenant isolation / RLS
      ↓
Entitlements
      ↓
Input validation
      ↓
Rate limiting
      ↓
Provider verification
```

A UI nunca substitui estas verificações.

## Authentication

A autenticação é feita através de Supabase Auth. Sessões e identidade devem ser verificadas no servidor em operações protegidas.

## Authorization e tenants

Um utilizador autenticado não significa acesso a qualquer tenant. Endpoints sensíveis devem resolver utilizador, tenant, role/permissões e entitlement.

O cliente não pode transformar um ID enviado no request num acesso autorizado.

## RLS

PostgreSQL Row Level Security é uma camada essencial do isolamento. Alterações a tabelas sensíveis exigem revisão das policies correspondentes.

## Secrets

Nunca expor `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BREVO_API_KEY`, `CRON_SECRET`, `RATE_LIMIT_SECRET` ou credenciais AWS.

Secrets server-side nunca devem ser prefixados com `NEXT_PUBLIC_`.

## Billing security

Price IDs, plano, provider, permissões e estado da subscrição devem ser validados server-side. Nunca usar um `priceId` arbitrário vindo da URL como autoridade para conceder acesso.

## API security

Auditorias automáticas procuram endpoints sem guards reconhecíveis de autenticação/tenant. Fluxos públicos sensíveis devem usar rate limiting e validação rigorosa.

## Embedding / clickjacking

Páginas públicas podem ser embeddadas para integrações como Silentra e Whop.

Login, recuperação/reset de password, registo, confirmação de email, onboarding, my-bookings, checkout, dashboard, mensagens, administração e APIs devem bloquear framing.

Para superfícies privadas:

```http
Content-Security-Policy: frame-ancestors 'none';
X-Frame-Options: DENY
```

Permitir iframe numa página pública não concede autorização adicional.

## Security headers

O Next.js configura headers como `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security` e políticas anti-framing nas superfícies sensíveis.

## Incident handling

Em caso de exposição de secret:

1. Revogar/rotacionar o secret.
2. Identificar ambientes afetados.
3. Rever logs e acessos.
4. Corrigir a causa.
5. Executar QA/security audit.
6. Fazer deploy.
7. Documentar o incidente.

Nunca publicar secrets em issues, PRs ou commits.
