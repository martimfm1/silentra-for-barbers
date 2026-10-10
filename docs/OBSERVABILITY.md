# Production observability

## Goals

Production logs exist to answer three questions quickly:

1. Which operation failed?
2. Where did it fail?
3. Was the failure caused by infrastructure, validation, authorization or application logic?

## Logger

Use `productionLogger` from `lib/observability/logger.ts` for server-side operational logs.

Prefer event names such as:

- `booking.create_failed`
- `booking.availability_failed`
- `marketing.campaign_load_failed`
- `settings.update_failed`
- `server.unhandled_rejection`

Use stable context fields such as `route`, `operation`, `status`, `error_code`, `request_id` and `duration_ms`.

## Never log

Do not log passwords, access tokens, refresh tokens, authorization headers, cookies, API keys, QR payloads, email addresses, phone numbers, birth dates or full request bodies.

The logger redacts sensitive keys as a second line of defence, but callers should still avoid passing sensitive data.

## Unhandled errors

`instrumentation.ts` registers production handlers for `uncaughtException` and `unhandledRejection`. They keep diagnostic information in the server logs without exposing request payloads.

## API routes

API handlers should:

- return a user-safe error message;
- log the internal event once at the boundary;
- include an error code when available;
- never log the complete Supabase, Stripe or provider object.

Expected user-facing errors are not exceptional and should generally not be logged as server errors (for example, invalid form input or an occupied booking slot).

## Silentra Admin — Saúde da API

The `/silentra-admin?tab=api_health` view reads from the private
`platform_api_logs` table and shows HTTP request volume, 5xx rate, latency
(p95 over the retained sample), route-level metrics, request IDs, and recent
status/error records. API route handlers use `withApiObservability` from
`lib/observability/api.ts`.

The telemetry record intentionally stores only the normalized route template,
HTTP method/status, elapsed handler time, a generated request ID, environment,
region, and a safe error code. It never stores request/response bodies, query
strings, cookies, authorization headers, IP addresses, email addresses or phone
numbers. The table is service-role-only and requires the
`platform_api_observability` migration.

INFO records are written as structured JSON to stdout, while warnings and errors
remain visible in platform runtime logs.

## Dashboard checks and interpretation

- The dashboard checks Supabase tables used by the core product and performs
  read-only GET requests to the configured Stripe and Brevo account endpoints.
  It does not create charges, update configuration, or send email.
- HTTP 4xx responses are presented separately from 5xx responses so invalid or
  unauthorized requests are not confused with application/server failures.
- Route-level latency and error percentages are calculated from the recent
  telemetry sample. The aggregate request count uses database counts when
  available; latency percentiles describe the sample loaded by the dashboard,
  not all requests ever received.
- The current view reads the previous 24 hours and loads up to 2,000 records.
  This table does not imply automatic retention or deletion; retention needs an
  explicit policy before a cleanup job is enabled.
- Historical API logs only begin after the route instrumentation and migration
  have been deployed. A newly enabled dashboard cannot reconstruct older
  requests.

Request logging is scheduled after the handler response so the Supabase insert
does not add database round-trip latency to the client-facing response. If
persistence fails, the request itself still succeeds or fails according to its
normal handler result, and a safe logger event records the telemetry failure.
