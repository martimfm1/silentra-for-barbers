# Production observability

Silentra for Barbers uses PostHog for product analytics/session replay and Sentry
for error tracking/performance. PostHog is disabled in development. Local Sentry
reporting is opt-in through `NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV=true`.

## Environment variables

Add these to `.env.local` for local build configuration, and configure the
production values in Vercel's Production environment before deploying:

| Variable                           | Purpose                                         | Visibility                    |
| ---------------------------------- | ----------------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog project token                          | Browser/public                |
| `NEXT_PUBLIC_POSTHOG_HOST`          | PostHog ingestion host                          | Browser/public                |
| `NEXT_PUBLIC_SENTRY_DSN`           | Sentry browser DSN                              | Browser/public                |
| `SENTRY_DSN`                       | Sentry Node.js/Edge DSN                         | Server-only                   |
| `NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV` | Set to `true` to send local development errors  | Browser/public                |
| `SENTRY_ORG`                       | Sentry organization slug for source map uploads | Build/server-only             |
| `SENTRY_PROJECT`                   | Sentry project slug for source map uploads      | Build/server-only             |
| `SENTRY_AUTH_TOKEN`                | Sentry source-map upload token                  | Secret; never expose publicly |

The DSN and PostHog project key are designed to be public identifiers, not
secret credentials. `SENTRY_AUTH_TOKEN` is a secret and must never be prefixed
with `NEXT_PUBLIC_` or committed to Git.

## Runtime rules and privacy

- Sentry initializes in production when its corresponding DSN exists. In local
  development, set `NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV=true` to opt in; browser
  Sentry still requires analytics consent. PostHog remains production only.
- PostHog and browser Sentry initialize only after the existing
  `silentra_cookie_consent` cookie grants the analytics category. Changing the
  preference reloads the page and applies the new choice.
- PostHog autocapture is disabled. Page views are tracked on Next.js route
  changes; product events are emitted explicitly by application code. Session
  replay is sampled at `0.2`; inputs are masked, sensitive text uses
  `ph-mask`/`data-ph-mask`/`data-sensitive`, and private sections are blocked
  with `ph-no-capture`/`data-ph-no-capture`/`data-private-data`. Its `before_send`
  hook strips URL query strings, fragments, and identifier-like path segments.
- PostHog exception capture is enabled only after analytics consent. Server log
  export runs only in production and emits service-level records without
  request or customer data. PostHog user identity uses only the stable Supabase
  user ID; event properties redact email addresses and phone numbers.
- Sentry removes request payloads, query strings, breadcrumb data, arbitrary
  extras, and common email/phone patterns before sending events.
- Sentry uses `tracesSampleRate: 0.1`, granular `dataCollection` controls with
  user info, cookies, request bodies, and GenAI data disabled, ignores common
  ResizeObserver/extension/ad-blocker noise, strips query strings and request
  bodies, and removes cookies/auth headers before events leave the app.
- Sentry Replay is sampled at `0.1` for sessions and `1.0` for sessions with
  errors. It masks all text and inputs, blocks media, and excludes private
  sections using its own no-capture selectors.
- Node.js and Edge Sentry setup is kept separate. Server-side request failures
  are operational diagnostics; browser analytics and browser Sentry remain
  gated by analytics consent.

## Capture a product event

Use `captureProductEvent` from a client-side flow. Never pass customer names,
phone numbers, email addresses, customer IDs, appointment IDs, notes, or form
contents as event properties.

```ts
import { captureProductEvent } from '@/lib/observability/posthog';

captureProductEvent('agendamento_criado', {
  origem: 'dashboard',
  recorrente: false,
  quantidade: 1,
});
```

The manual booking workflow already emits `agendamento_criado` with only these
non-identifying properties.

## Capture a caught exception

Use `captureException` in a `try/catch` when an exception is handled and would
otherwise be invisible to Sentry's automatic request instrumentation:

```ts
import { captureException } from '@/lib/observability/sentry';

try {
  await performOperation();
} catch (error) {
  captureException(error, {
    area: 'appointments',
    action: 'create_booking',
  });
  throw error;
}
```

The helper tags the exception with the operation context, but does not attach
customer data or request payloads.

## Setup checklist

1. Copy the PostHog project token and ingestion host for the configured project.
2. Create the Sentry project for Next.js and copy its DSN. Add a Sentry auth
   token only when source-map uploads are desired.
3. Set the values in Vercel **Project → Settings → Environment Variables** for
   Production, then redeploy `main`.
4. Accept the analytics category in the production cookie banner and verify a
   page view/event and a sampled replay in PostHog. With analytics rejected,
   browser PostHog/Sentry must remain uninitialized.
5. Verify a test exception in Sentry and confirm readable source maps when the
   optional build-upload credentials are configured.

`pnpm qa:observability` checks the production guards, PostHog initialization,
and CI wiring without sending telemetry.
