# Production release checklist

This checklist must be completed before enabling customer traffic on a release.

## 1. Code and CI

- [ ] CI on the exact release commit is green: typecheck, lint, API/security/product QA, dependency audit, Prettier format check, production build and smoke QA.
- [ ] Review the PR diff and confirm no secrets, customer data or production credentials were committed.
- [ ] Confirm Vercel is deploying the intended commit and production domain.
- [ ] Review Supabase Security and Performance Advisors. Classify intentional service-role-only tables without client policies separately from genuine access-control defects; review exposed `SECURITY DEFINER` RPCs before release.

## 2. Environment

Configure the production environment in Vercel, then run `pnpm qa:env` against those variables in a trusted environment. Do not print secret values in logs.

Required values include Supabase URL/anon key/service-role key, Stripe secret/webhook keys, Brevo API key, and a `RATE_LIMIT_SECRET` with at least 32 characters of entropy. Set `NEXT_PUBLIC_APP_URL` (preferred) or `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin, for example `https://barbers.silentra.me`.

Never prefix service-role, Stripe, Brevo, webhook, cron or rate-limit secrets with `NEXT_PUBLIC_`.

## 3. Supabase migrations

Apply pending migrations in chronological order using the project's normal migration process. In particular, verify these migrations have been applied successfully:

- `20260813190000_public_booking_rate_limit.sql`
- `20261013000000_marketplace_order_tracking_tokens.sql`
- `20261013010000_grant_public_rate_limit_service_role.sql`
- `20261013020000_harden_public_security_definer_privileges.sql`

The tracking-token migration stores only the SHA-256 hash of the random tracking capability. The rate-limit grant is required for the service-role client to invoke the protected database function after public execution was revoked.

The security hardening migration also removes anonymous execution from a legacy professional-creation RPC and trigger-only functions, and pins search paths for functions flagged by the production advisor. Public review submission remains intentionally public and performs its own validation.

Do not mark this step complete based only on files existing in GitHub; confirm the migration history and SQL execution in the target Supabase project.

## 4. Marketplace acceptance tests

Use a test barbershop and non-customer test data.

- [ ] A valid order reserves stock atomically and stores the expected totals.
- [ ] A stock conflict does not create a partial order or reduce stock.
- [ ] Products from another barbershop cannot be ordered by changing request IDs.
- [ ] Invalid customer fields, malformed UUIDs, excessive items and invalid quantities are rejected.
- [ ] Missing/invalid tracking tokens do not reveal whether a specific order exists or any customer details.
- [ ] A valid tracking link shows only the order reference, status, product lines, total, shop and fulfillment method.
- [ ] The response is not cached; repeated invalid lookups are rate limited.
- [ ] The receipt email links to the canonical HTTPS origin, not a request-supplied Host header.
- [ ] Email provider failure does not create duplicate orders or report a committed order as failed.
- [ ] Dashboard status transitions preserve the allowed lifecycle, tenant boundaries, stock restoration on cancellation and status-event history.

## 5. Go-live and rollback

- [ ] Verify `/api/health`, marketplace catalog, checkout, tracking and dashboard order status in production.
- [ ] Review sanitized Vercel logs for `MARKETPLACE_*`, rate-limit and email delivery failures.
- [ ] Keep a rollback deployment ready. Database migrations should be reviewed for backward compatibility before rollback.
- [ ] Do not accept live customer orders until all checks above have passed.
