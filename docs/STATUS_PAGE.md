# Public status page

The public status page is available at:

- https://barbers.silentra.me/status
- JSON endpoint: https://barbers.silentra.me/api/public/status

## Monitored components

- Application and public status API: the server response serving the status request.
- Database: a read-only request to the platform's Supabase REST API using the server-side service-role credential. No records are returned to the browser.
- Supabase, Vercel, Stripe and Brevo: current status, unresolved incidents and scheduled maintenance from each provider's public Statuspage API.

Provider data is cached for 60 seconds. The public API response is shared-cacheable for 60 seconds with a 5-minute stale-while-revalidate window. Provider timeouts and unavailable status feeds are reported as unknown, never as operational.

## Important scope

This page is a current status view, not an independent uptime-monitoring service. It does not calculate historical uptime percentages and it cannot guarantee that every account, integration, region or individual workflow is healthy. Provider status reflects the provider's own public report.

The status page is served by the same Silentra for Barbers deployment. A full application or hosting outage may therefore also affect access to this page. For provider-specific details, use the official status links shown beside each component.

## Required environment

The database probe requires:

- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

The service-role key is used only by the server-side route and is never included in the public response.
