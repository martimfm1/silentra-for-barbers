# Isolated authenticated E2E

The authenticated E2E suite uses a disposable Supabase local stack. It never connects to the hosted Silentra database and never uses real customer or staff accounts.

## What it covers

- Two synthetic owners create two independent barbershops through the real onboarding API.
- The owners receive Pro entitlements only inside the local test database so invite seat limits and MB WAY can be exercised.
- Synthetic staff accounts log in through the browser, follow invite redirects, accept link and QR bearer invites in the onboarding UI, and survive a dashboard refresh.
- The public barbershop page is loaded at desktop and mobile viewport sizes.
- Public booking, cross-tenant reads/writes, staff activity access, rescheduling, confirmation, completion, individual cancellation and MB WAY prepayment are checked against the real local API and Postgres schema.
- All Auth users and created barbershops are removed in finally; the workflow then stops Supabase with no-backup, discarding the local database.

## Run locally

Requirements: Node.js 24, pnpm 12.10.1, Docker, and enough memory for Supabase local development.

    pnpm install --frozen-lockfile
    pnpm exec supabase start --exclude studio,mailpit,logflare,supavisor,edge-runtime,vector
    pnpm exec supabase status -o env

Export the API_URL, ANON_KEY and SERVICE_ROLE_KEY values from the local status output as:

    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
    SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
    RATE_LIMIT_SECRET=<random-value-of-at-least-32-characters>
    NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
    E2E_BASE_URL=http://127.0.0.1:3000

Install the browser runner temporarily (it is not added to the production dependency graph):

    npm install --no-save --package-lock=false playwright@1.56.1
    npx playwright install chromium

Then start the app in one terminal and execute the test in another:

    pnpm dev
    node scripts/e2e/booking-tenant-isolation.mjs

Stop and discard the local database afterwards:

    pnpm exec supabase stop --no-backup

## Safety boundary

The runner validates that both the application URL and Supabase URL resolve to loopback addresses before creating any fixture. It refuses remote hosts, including the production domain. The service-role key is only used by the Node.js fixture runner for local Auth seeding, plan assignment, read-back and cleanup; it is never passed to browser code. E2E email addresses use the reserved .invalid domain and no real outbound email provider is configured.
