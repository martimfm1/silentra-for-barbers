# Public status page

The public status page is available at:

- https://barbers.silentra.me/status
- JSON endpoint: https://barbers.silentra.me/api/public/status

## Monitored components

The page deliberately monitors only Silentra for Barbers infrastructure:

- **APIs da Silentra:** the application makes a server-side request to its internal `/api/health` endpoint. A response time of two seconds or more is shown as degraded performance.
- **Base de dados:** a read-only query to the primary Supabase REST table verifies that the platform can reach its database. No rows or customer information are included in the public response.

No third-party provider status pages, payment processors, email providers, hosting vendor incidents or external maintenance windows are displayed.

The public API response is cached by the CDN for 30 seconds with a 2-minute stale-while-revalidate window. The page refreshes its view every 60 seconds. A timeout or confirmed server-side failure is reported as an outage; missing credentials, invalid configuration or an unexpected health response are reported as unknown rather than operational.

## Important scope

This is a current infrastructure status view, not an independent uptime-monitoring service. It does not calculate historical uptime percentages or guarantee that every individual API route or customer workflow is healthy.

The status page is served by the same Silentra for Barbers deployment. A full application or hosting outage may therefore also affect access to the page.

## Required environment

The database check requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is only used server-side and is never included in the public response.
