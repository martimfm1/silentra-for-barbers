# Production observability

## Goals

Production observability helps answer:

1. Which operation failed?
2. Which API route returned an error, and how long did it take?
3. Is the database and the service configuration healthy?
4. Can the incident be correlated by a request ID?

## API request history

API route handlers can be wrapped with `withApiLogging` from
`lib/observability/api-request.ts`. Each captured request records a generated
request ID, HTTP method, stable route template, response status, duration,
severity, and a safe error code when available.

The log intentionally excludes request bodies, query strings, authentication
headers, cookies, IP addresses, email addresses, phone numbers, and provider
payloads. The response includes `x-silentra-request-id` when its headers are
mutable. The persistence operation is fail-open: a logging outage must never
turn a successful booking or payment into a failed request.

The internal **Saúde & Logs** section shows request volume, error rates, latency,
routes with most failures, recent request history, and dependency checks. These
metrics begin when logging is deployed and the database migration is applied;
they cannot reconstruct events from before that point.

## Required database migration

Apply `supabase/migrations/20261010160000_platform_api_observability.sql`
to the Supabase project used by the deployment. The table has RLS enabled and
is only accessible to the server-side service role; it is not exposed to browser
clients. If the migration is missing, the app continues working but the admin
panel explicitly reports that request history is not configured.

## Logger

Use `productionLogger` from `lib/observability/logger.ts` for server-side
operational logs. Prefer stable event names such as `booking.create_failed`
and context fields such as `route`, `operation`, `status`, `error_code`,
`request_id`, and `duration_ms`.

Never log passwords, access tokens, refresh tokens, authorization headers,
cookies, API keys, QR payloads, email addresses, phone numbers, birth dates, or
full request bodies. Never log full Supabase, Stripe, or provider response
objects.

## Unhandled errors

`instrumentation.ts` registers production handlers for `uncaughtException`
and `unhandledRejection`. They keep diagnostic information in server logs
without exposing request payloads.

Expected user-facing errors (for example, invalid form input or an occupied
booking slot) should be represented by HTTP status and a safe message; they
should not be logged as infrastructure exceptions.
