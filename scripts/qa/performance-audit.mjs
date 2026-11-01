import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const read = (file) => readFile(join(process.cwd(), file), 'utf8');

const [
  nextConfig,
  layout,
  directoryCard,
  publicStorefront,
  marketplaceApi,
  pricesApi,
  observability,
  customerSupportApi,
  adminSupportApi,
  customerSupportUi,
  adminSupportUi,
  billingSummaryApi,
  billingHistoryApi,
  adminObservabilityApi,
  clientDetailApi,
  bookingDataApi,
  moduleAuthorization,
  planAccessGuard,
  subscriptionService,
  apiHotPathMigration,
] = await Promise.all([
  read('next.config.ts'),
  read('app/layout.tsx'),
  read('app/barbershops/components/shop-card.tsx'),
  read('app/barbershops/[slug]/public-barbershop-page-final.tsx'),
  read('app/api/marketplace/products/route.ts'),
  read('app/api/stripe/prices/route.ts'),
  read('lib/observability/api.ts'),
  read('app/api/support/conversations/route.ts'),
  read('app/api/silentra-admin/support/route.ts'),
  read('app/dashboard/suporte/page.tsx'),
  read('app/_silentra-admin/support-inbox.tsx'),
  read('app/api/stripe/billing-summary/route.ts'),
  read('app/api/billing/history/route.ts'),
  read('app/api/silentra-admin/observability/route.ts'),
  read('app/api/crm/clients/[clientId]/route.ts'),
  read('app/api/shops/[id]/booking-data/route.ts'),
  read('services/modules/authorization.ts'),
  read('services/billing/plan-access.guard.ts'),
  read('services/billing/subscription.service.ts'),
  read('supabase/migrations/20261101190000_api_hot_path_optimizations.sql'),
]);

assert.match(
  nextConfig,
  /formats:\s*\[\s*'image\/avif',\s*'image\/webp'\s*\]/,
  'Next Image should serve AVIF/WebP where supported.',
);
assert.doesNotMatch(
  layout,
  /const geistSans\s*=\s*Geist\(/,
  'The unused Geist Sans font should not be downloaded site-wide.',
);
assert.match(
  layout,
  /<Script id="whop-pixel" strategy="afterInteractive">/,
  'The Whop pixel must not compete with critical first paint resources.',
);
assert.doesNotMatch(
  directoryCard + publicStorefront,
  /\bunoptimized\b/,
  'Public shop images should use the Next Image optimizer.',
);

assert.match(
  marketplaceApi,
  /PUBLIC_CATALOG_CACHE\s*=\s*'public, max-age=0, s-maxage=15, stale-while-revalidate=45'/,
  'Public catalogue cache must be short-lived and stale-while-revalidate.',
);
assert.match(
  marketplaceApi,
  /Cache-Control': PUBLIC_CATALOG_CACHE/,
  'Successful public catalogue responses should use the CDN cache policy.',
);
assert.match(
  marketplaceApi,
  /featuredProductsPromise/,
  'The featured-product query should be started in parallel with the base query.',
);
assert.match(
  pricesApi,
  /s-maxage=60, stale-while-revalidate=120/,
  'Public plan prices should be cached at the CDN.',
);
assert.match(
  observability,
  /isSharedCacheableResponse/,
  'Observability must identify shared-cacheable responses.',
);
assert.match(
  observability,
  /!isSharedCacheableResponse\(response\)/,
  'Shared cache entries must not retain a per-request correlation ID.',
);

assert.doesNotMatch(
  customerSupportUi + adminSupportUi,
  /setInterval\(/,
  'Support polling must not overlap while a slow request is still in flight.',
);
assert.match(
  customerSupportUi + adminSupportUi,
  /scheduleNextPoll/,
  'Support polling should schedule the next request only after completion.',
);
assert.match(
  customerSupportApi,
  /getEffectiveSupportPlan\(admin, shop\.id\)/,
  'Customer ticket reads should request plan context as part of parallel reads.',
);
assert.doesNotMatch(
  customerSupportApi,
  /const staleTickets =/,
  'Customer ticket GETs must not perform per-ticket synchronization writes.',
);
assert.match(
  adminSupportApi,
  /support_unread_counts/,
  'Admin unread counts should be aggregated by Postgres instead of downloading every message ID.',
);
assert.doesNotMatch(
  adminSupportApi,
  /normalizedConversations = await Promise\.all/,
  'Admin inbox normalization must not issue one asynchronous Auth call per ticket.',
);
assert.match(
  billingSummaryApi,
  /subscriptionIsFresh/,
  'Billing summary should avoid repeated Stripe reconciliation for fresh subscription rows.',
);
assert.match(
  billingHistoryApi,
  /timeout: 6000/,
  'Billing history should bound its dependency on the Stripe invoice API.',
);
assert.match(
  adminObservabilityApi,
  /await Promise\.all\(\[\s*admin[\s\S]*platform_api_logs/,
  'API health telemetry reads should run concurrently.',
);
assert.doesNotMatch(
  adminObservabilityApi,
  /select\('id', \{ head: true, count: 'exact' \}\)/,
  'Availability probes should not run expensive exact row counts.',
);


assert.match(
  clientDetailApi,
  /get_client_completed_total_spent/,
  'Client lifetime spend should be aggregated inside Postgres.',
);
assert.doesNotMatch(
  clientDetailApi,
  /getCompletedAppointmentsTotal|\.range\(/,
  'Client profile reads must not paginate every completed appointment just to calculate spend.',
);
assert.match(
  bookingDataApi,
  /await Promise\.all\(\[/,
  'Independent booking availability reads should execute concurrently.',
);
assert.doesNotMatch(
  bookingDataApi,
  /createClient\(|@\/lib\/supabase\/server/,
  'Public booking availability must not create an unused SSR auth client.',
);
assert.match(
  planAccessGuard,
  /getAccessContextForUser\(\s*userId,\s*permissionKeys/,
  'Request authorization should use one combined plan/permission context.',
);
assert.match(
  moduleAuthorization,
  /getAccessPlanForRequest\(request, acceptedPermissions\)/,
  'Module permission checks should be included in the combined access lookup.',
);
assert.doesNotMatch(
  moduleAuthorization,
  /hasMemberPermission\(/,
  'Module authorization must not make sequential per-table permission reads.',
);
assert.match(
  subscriptionService,
  /rpc\(\s*'get_module_access_context'/,
  'The combined access RPC should resolve user tenant, plan and permission state.',
);
assert.match(
  subscriptionService,
  /rpc\(\s*'get_effective_billing_plan_for_barbershop'/,
  'Barbershop plan reads should use persisted webhook state rather than Stripe reconciliation.',
);
assert.match(
  apiHotPathMigration,
  /create index if not exists appointments_client_timeline_idx/i,
  'Client history and spending queries should have a covering tenant index.',
);
assert.match(
  apiHotPathMigration,
  /create or replace function public\.get_module_access_context/i,
  'The migration should install the combined service-role-only access resolver.',
);
assert.match(
  apiHotPathMigration,
  /revoke all on function public\.get_module_access_context\(uuid, text\[\]\)/i,
  'The combined resolver must not be executable by public or authenticated roles.',
);

console.log(
  '[PERFORMANCE_QA] image optimization, parallel data paths, tenant access aggregation and CRM database aggregates passed',
);
