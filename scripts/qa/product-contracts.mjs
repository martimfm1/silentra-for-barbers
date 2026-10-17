import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

async function read(path) {
  return readFile(resolve(root, path), 'utf8');
}

const checks = [
  {
    name: 'Final booking migration uses appointment_status',
    file: 'supabase/migrations/20260905150000_finalize_atomic_booking_contract.sql',
    test: (source) =>
      source.includes('v_status public.appointment_status') &&
      source.includes("'pending'::public.appointment_status") &&
      source.includes("'scheduled'::public.appointment_status"),
  },
  {
    name: 'Final booking migration enforces closed days',
    file: 'supabase/migrations/20260905150000_finalize_atomic_booking_contract.sql',
    test: (source) =>
      source.includes('BARBERSHOP_CLOSED_DAY') &&
      source.includes("at time zone 'Europe/Lisbon'") &&
      source.includes('unnest(string_to_array'),
  },
  {
    name: 'Final booking migration links existing clients',
    file: 'supabase/migrations/20260905150000_finalize_atomic_booking_contract.sql',
    test: (source) =>
      source.includes('v_client_id uuid') &&
      source.includes("u.role = 'client'") &&
      source.includes('= v_phone'),
  },
  {
    name: 'Canonical onboarding join route uses invite RPC',
    file: 'app/api/onboarding/join-v2/route.ts',
    test: (source) =>
      source.includes("rpc('join_barbershop_with_invite'") &&
      source.includes('BARB-7K4P-9X2M'),
  },
  {
    name: 'Legacy onboarding join delegates to the canonical route',
    file: 'app/api/onboarding/join/route.ts',
    test: (source) =>
      source.includes("from '@/app/api/onboarding/join-v2/route'") &&
      source.includes('export { POST }'),
  },
  {
    name: 'Invite generator migration creates BARB formatted codes',
    file: 'supabase/migrations/20260905121500_standardize_team_invite_codes.sql',
    test: (source) =>
      source.includes("v_code := 'BARB-'") &&
      source.includes('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
  },
  {
    name: 'Marketplace order RPC includes delivery fields used by the API',
    file: 'supabase/migrations/20260830210000_marketplace_sales_channels.sql',
    test: (source) =>
      source.includes("p_fulfillment_method text default 'pickup'") &&
      source.includes('p_shipping_address text default null') &&
      source.includes('p_shipping_city text default null') &&
      source.includes('p_shipping_postal_code text default null') &&
      source.includes('shipping_address') &&
      source.includes('shipping_city') &&
      source.includes('shipping_postal_code'),
  },
  {
    name: 'Marketplace order API sends the canonical delivery RPC parameters',
    file: 'app/api/marketplace/orders/route.ts',
    test: (source) =>
      source.includes("rpc('create_marketplace_order_atomic'") &&
      source.includes('p_fulfillment_method: fulfillmentMethod') &&
      source.includes('p_shipping_address:') &&
      source.includes('p_shipping_city:') &&
      source.includes('p_shipping_postal_code:') &&
      source.includes('p_shipping_country:'),
  },
  {
    name: 'Marketplace lifecycle has durable order events',
    file: 'supabase/migrations/20260905133000_marketplace_order_lifecycle.sql',
    test: (source) =>
      source.includes('marketplace_order_events') &&
      source.includes('record_marketplace_order_status_event'),
  },
  {
    name: 'Marketplace lifecycle validates transitions',
    file: 'supabase/migrations/20260905133000_marketplace_order_lifecycle.sql',
    test: (source) =>
      source.includes('update_marketplace_order_status_atomic') &&
      source.includes('invalid_order_transition'),
  },
  {
    name: 'Manual customer email is scoped to the barbershop',
    file: 'app/api/marketplace/orders/[orderId]/email/route.ts',
    test: (source) =>
      source.includes("requireModuleContext('pos', 'pos')") &&
      source.includes(".eq('barbershop_id', barbershopId)") &&
      source.includes('sendBrevoEmail') &&
      source.includes('createMarketplaceTrackingToken()') &&
      source.includes('hashMarketplaceTrackingToken(trackingToken)') &&
      source.includes('marketplace_order_tracking_tokens') &&
      source.includes('contactPixelTrackingConsent: false') &&
      source.includes('Acompanhar encomenda'),
  },
  {
    name: 'Terms drawer keeps its heading fixed and scrolls the legal content on mobile',
    file: 'components/legal/terms-drawer.tsx',
    test: (source) =>
      source.includes('data-terms-scroll-area') &&
      source.includes('data-vaul-no-drag="true"') &&
      source.includes('min-h-0 flex-1') &&
      source.includes('touch-pan-y') &&
      source.includes('overscroll-y-contain') &&
      source.includes('overflow-y-scroll') &&
      source.includes('[-webkit-overflow-scrolling:touch]') &&
      source.includes('max-h-[90dvh]'),
  },
  {
    name: 'Professional revenue chart keeps a compact X axis on mobile',
    file: 'app/dashboard/stats/page.tsx',
    test: (source) =>
      source.includes('className="stats-professional-chart border') &&
      source.includes('angle={-20}') &&
      source.includes('height={48}') &&
      source.includes('interval="preserveStartEnd"'),
  },
  {
    name: 'Mobile responsive layer prevents horizontal viewport scrolling and fits tables',
    file: 'app/silentra-responsive.css',
    test: (source) =>
      source.includes('overflow-x: clip') &&
      source.includes('.silentra-table-wrap table') &&
      source.includes('min-width: 0') &&
      source.includes('table-layout: fixed') &&
      source.includes('max-width: calc(100vw - 1rem)'),
  },
  {
    name: 'Dashboard tabs wrap instead of requiring horizontal scrolling',
    file: 'components/dashboard/animated-tabs.tsx',
    test: (source) =>
      source.includes('flex-wrap') &&
      source.includes('basis-[calc(50%-0.25rem)]') &&
      !source.includes('overflow-x-auto'),
  },
  {
    name: 'Mobile dashboard blocks viewport horizontal overflow and wraps dense content',
    file: 'app/silentra-responsive.css',
    test: (source) =>
      source.includes('overflow-x: clip') &&
      source.includes('overscroll-behavior-x: none') &&
      source.includes('.silentra-dashboard-main') &&
      source.includes('min-width: 0'),
  },
  {
    name: 'Public barbershop page provides a mobile-safe persistent booking action',
    file: 'app/barbershops/[slug]/public-barbershop-page-final.tsx',
    test: (source) =>
      source.includes('fixed inset-x-0 bottom-0') &&
      source.includes('pb-[max(0.75rem,env(safe-area-inset-bottom))]') &&
      source.includes('sm:hidden') &&
      source.includes('setBookingOpen(true)'),
  },
  {
    name: 'Public booking has mobile-safe horizontal overflow rules',
    file: 'app/silentra-responsive.css',
    test: (source) =>
      source.includes('overflow-x: clip') &&
      source.includes('safe-area-inset-bottom') &&
      source.includes("nav[aria-label='Navegação rápida']"),
  },
  {
    name: 'Marketplace product publication migration caps boost at three days',
    file: 'supabase/migrations/20261013160000_marketplace_product_publication_boost.sql',
    test: (source) =>
      source.includes('marketplace_published_at') &&
      source.includes('marketplace_featured_until') &&
      source.includes('coalesce(created_at, updated_at, now())') &&
      source.includes("interval '3 days'") &&
      source.includes('inventory_products_marketplace_featured_window_check'),
  },
  {
    name: 'Marketplace product creation verifies Enterprise entitlement server-side',
    file: 'app/api/marketplace/manage/products/route.ts',
    test: (source) =>
      source.includes("rpc('get_effective_billing_plan_for_barbershop'") &&
      source.includes("plan !== 'enterprise'") &&
      source.includes('marketplace_published_at: publishedAt') &&
      source.includes('marketplace_featured_until: featuredUntil'),
  },
  {
    name: 'Marketplace sellers can publish products without an optional image URL',
    file: 'app/api/marketplace/manage/products/route.ts',
    test: (source) =>
      source.includes(
        "typeof body?.imageUrl === 'string' && body.imageUrl.trim()",
      ) &&
      source.includes(': null,') &&
      source.includes('product.name.length >= 1') &&
      source.includes('product.unit_price >= 0') &&
      source.includes('Number.isInteger(product.stock_quantity)'),
  },
  {
    name: 'Marketplace product update enforces the original three-day publication window',
    file: 'app/api/marketplace/manage/products/[productId]/route.ts',
    test: (source) =>
      source.includes("plan !== 'enterprise'") &&
      source.includes('Date.parse(publishedAt) + BOOST_WINDOW_MS') &&
      source.includes('O destaque só pode ser ativado nos primeiros 3 dias'),
  },
  {
    name: 'Marketplace public product detail checks UUID and seller visibility',
    file: 'app/api/marketplace/products/route.ts',
    test: (source) =>
      source.includes('productId && !UUID_PATTERN.test(productId)') &&
      source.includes('marketplace_featured_until') &&
      source.includes('relation?.is_public_in_directory === true') &&
      source.includes(
        "relation?.marketplace_sales_mode === 'physical_and_online'",
      ) &&
      source.includes('Produto não encontrado ou indisponível.'),
  },
  {
    name: 'Marketplace prioritizes only unexpired Enterprise boosts',
    file: 'app/api/marketplace/products/route.ts',
    test: (source) =>
      source.includes(
        ".gt('marketplace_featured_until', new Date().toISOString())",
      ) &&
      source.includes('...activeFeatured') &&
      source.includes('visible.filter((item) => !featuredIds.has(item.id))'),
  },
  {
    name: 'Marketplace has dedicated product pages and add-to-cart handoff',
    file: 'app/marketplace/[productId]/page.tsx',
    test: (source) =>
      source.includes('/api/marketplace/products?id=${encodeURIComponent(productId)}') &&
      source.includes("searchParams.set('add', product.id)") &&
      source.includes('searchParams.set(') &&
      source.includes("t('storefront.addToCart')"),
  },
  {
    name: 'Marketplace catalog cards link to product detail pages and persist cart',
    file: 'app/marketplace/page.tsx',
    test: (source) =>
      source.includes('href={`/marketplace/${product.id}`}') &&
      source.includes('silentra-marketplace-cart') &&
      source.includes("url.searchParams.get('add')"),
  },
  {
    name: 'Marketplace tracking capability migration hashes links, preserves legacy links, and expires tokens',
    file: 'supabase/migrations/20261013180000_marketplace_order_tracking_capabilities.sql',
    test: (source) =>
      source.includes('marketplace_order_tracking_tokens') &&
      source.includes('token_hash text not null unique') &&
      source.includes("now() + interval '365 days'") &&
      source.includes('revoked_at') &&
      source.includes('tracking_token_hash'),
  },
  {
    name: 'Marketplace order creation stores hash-only tracking capabilities',
    file: 'app/api/marketplace/orders/route.ts',
    test: (source) =>
      source.includes('createMarketplaceTrackingToken()') &&
      source.includes('hashMarketplaceTrackingToken(') &&
      source.includes("from('marketplace_order_tracking_tokens')") &&
      source.includes('buildMarketplaceTrackingUrl') &&
      source.includes('contactPixelTrackingConsent: false'),
  },
  {
    name: 'Brevo passes per-recipient consent without making tracking mandatory',
    file: 'lib/email/brevo.ts',
    test: (source) =>
      source.includes('contactPixelTrackingConsent?: boolean;') &&
      source.includes('contactPixelTrackingConsent:') &&
      source.includes('input.contactPixelTrackingConsent'),
  },
  {
    name: 'Customer tracking API resolves revocable tokens and returns status history',
    file: 'app/api/marketplace/orders/track/route.ts',
    test: (source) =>
      source.includes('isMarketplaceTrackingToken(token)') &&
      source.includes("from('marketplace_order_tracking_tokens')") &&
      source.includes('capability.revoked_at') &&
      source.includes('capability.expires_at') &&
      source.includes("from('marketplace_order_events')") &&
      source.includes("event.source !== 'manual_email'") &&
      source.includes("'Referrer-Policy': 'no-referrer'"),
  },
  {
    name: 'Marketplace status notification emails issue independent tracking links',
    file: 'app/api/marketplace/orders/[orderId]/route.ts',
    test: (source) =>
      source.includes('createMarketplaceTrackingToken()') &&
      source.includes("from('marketplace_order_tracking_tokens')") &&
      source.includes('buildMarketplaceTrackingUrl(token)') &&
      source.includes('Acompanhar encomenda') &&
      source.includes('contactPixelTrackingConsent: false') &&
      source.includes("completed: 'A sua encomenda foi concluída'"),
  },
  {
    name: 'Customer tracking experience shows progress, history, delivery and manual refresh',
    file: 'app/marketplace/track/tracking-client.tsx',
    test: (source) =>
      source.includes("t('orderTracking.progress')") &&
      source.includes("t('orderTracking.history')") &&
      source.includes("t('orderTracking.deliveryDetails')") &&
      source.includes("t('orderTracking.refreshStatus')") &&
      source.includes('setInterval') &&
      source.includes("referrerPolicy: 'no-referrer'") &&
      source.includes('replaceState'),
  },
  {
    name: 'Tracking page is excluded from indexing and disables referrer leakage',
    file: 'app/marketplace/track/page.tsx',
    test: (source) =>
      source.includes('index: false') &&
      source.includes('follow: false') &&
      source.includes("referrer: 'no-referrer'"),
  },
  {
    name: 'Marketplace tracking token is scrubbed before analytics and pixels execute',
    file: 'app/layout.tsx',
    test: (source) => {
      const bootstrap = source.indexOf(
        'id="marketplace-tracking-token-bootstrap"',
      );
      const whopPixel = source.indexOf('id="whop-pixel"');
      return (
        source.includes('TRACKING_TOKEN_BOOTSTRAP_SCRIPT') &&
        source.includes('__SILENTRA_REVIEW_TOKEN__') &&
        source.includes('review_token') &&
        source.includes('__SILENTRA_CONSUME_MARKETPLACE_TRACKING_TOKEN__') &&
        source.includes('window.history.replaceState') &&
        bootstrap >= 0 &&
        whopPixel > bootstrap &&
        source.includes('GoogleTagManager gtmId="GTM-PBCWTRT5"')
      );
    },
  },
  {
    name: 'Private order tracking page overrides public page headers',
    file: 'next.config.ts',
    test: (source) => {
      const genericHeaders = source.indexOf("source: '/:path*'");
      const trackingHeaders = source.indexOf(
        "source: '/marketplace/track/:path*'",
      );
      return (
        trackingHeaders > genericHeaders &&
        source.includes("key: 'Cache-Control', value: 'no-store, max-age=0'") &&
        source.includes("key: 'Referrer-Policy', value: 'no-referrer'") &&
        source.includes("key: 'X-Frame-Options',") &&
        source.includes("value: 'DENY'")
      );
    },
  },
  {
    name: 'Custom website requests are Enterprise-only and validate user input server-side',
    file: 'app/api/dashboard/custom-website/route.ts',
    test: (source) =>
      source.includes("plan !== 'enterprise'") &&
      source.includes('RESERVED_SLUGS') &&
      source.includes('12_000') &&
      source.includes("from('custom_website_requests')") &&
      source.includes("context.user.id"),
  },
  {
    name: 'Custom website public route only renders explicitly published paths',
    file: 'app/[slug]/page.tsx',
    test: (source) =>
      source.includes("eq('status', 'published')") &&
      source.includes("eq('public_slug', slug)") &&
      source.includes("notFound()") &&
      source.includes('booking_slug'),
  },
  {
    name: 'Admin website publication requires a unique valid public path and site metadata',
    file: 'app/api/silentra-admin/custom-websites/[requestId]/route.ts',
    test: (source) =>
      source.includes('requirePlatformAdmin()') &&
      source.includes('RESERVED_SLUGS') &&
      source.includes('nextStatus === \'published\'') &&
      source.includes('nextSlug') &&
      source.includes('23505'),
  },
  {
    name: 'Custom website workflow is visible in Enterprise plan and customer dashboard',
    file: 'lib/billing/plan-features.ts',
    test: (source) =>
      source.includes("'custom_website'") &&
      source.includes("custom_website: 'Site próprio personalizado (por orçamento)'") &&
      source.includes("'custom_website',"),
  },
  {
    name: 'Enterprise checkout directs bespoke website requests to direct contact',
    file: 'app/checkout/page.tsx',
    test: (source) =>
      source.includes("intent.plan === 'enterprise'") &&
      source.includes('mailto:silentra.contact@gmail.com') &&
      source.includes('sujeito a orçamento'),
  },
  {
    name: 'Custom website requests are protected by a service-role-only database table',
    file: 'supabase/migrations/20261016180000_enterprise_custom_website_requests.sql',
    test: (source) =>
      source.includes('custom_website_requests') &&
      source.includes('enable row level security') &&
      source.includes('revoke all') &&
      source.includes('grant all on public.custom_website_requests to service_role') &&
      source.includes('custom_website_requests_public_slug_unique'),
  },
  {
    name: 'Customer booking drawer resets each step to the top and supports safe-area mobile scrolling',
    file: 'app/barbershops/components/booking-drawer-canonical.tsx',
    test: (source) =>
      source.includes('scrollAreaRef') &&
      source.includes('scrollTo({ top: 0, behavior: \'auto\' })') &&
      source.includes('data-booking-scroll-area') &&
      source.includes('touch-pan-y') &&
      source.includes('overscroll-contain') &&
      source.includes('safe-area-inset-bottom') &&
      source.includes('h-[min(90dvh,48rem)]'),
  },
  {
    name: 'Stripe webhook ledger stores sanitized failure identifiers only',
    file: 'app/api/stripe/webhook/route.ts',
    test: (source) => {
      const start = source.indexOf('async function markWebhookFailed');
      const end = source.indexOf('async function hydrateBillingMappingFromMetadata');
      const block = source.slice(start, end);
      return (
        start >= 0 &&
        end > start &&
        block.includes('safeName') &&
        block.includes('safeCode') &&
        block.includes('candidate.code') &&
        !block.includes('error.message')
      );
    },
  },
  {
    name: 'Public review API never inserts directly into the reviews table',
    file: 'app/api/public/reviews/route.ts',
    test: (source) =>
      source.includes("rpc(\n      'submit_public_review_with_token'") &&
      source.includes("createHash('sha256')") &&
      !source.includes("from('reviews')"),
  },
  {
    name: 'Public reviews require a single-use token tied to a completed appointment',
    file: 'supabase/migrations/20261016120000_verified_review_submission_tokens.sql',
    test: (source) =>
      source.includes('review_submission_tokens') &&
      source.includes('a.status = \'completed\'::public.appointment_status') &&
      source.includes('t.consumed_at is null') &&
      source.includes('t.expires_at > now()') &&
      source.includes('length(p_token_hash) <> 64') &&
      source.includes("translate(p_token_hash, '0123456789abcdef', '') <> ''") &&
      source.includes('set consumed_at = now()') &&
      source.includes('submit_public_review_with_token') &&
      source.includes('revoke all on function public.submit_public_review(uuid, text, integer, text)'),
  },
  {
    name: 'Completed booking issues a hashed, expiring review capability',
    file: 'app/api/appointments/[appointmentId]/complete/route.ts',
    test: (source) =>
      source.includes('randomBytes(32).toString(\'base64url\')') &&
      source.includes("createHash('sha256')") &&
      source.includes("from('review_submission_tokens')") &&
      source.includes("searchParams.set('review_token', reviewToken)") &&
      source.includes('expires_at'),
  },
  {
    name: 'Public review UI is only available from a review email capability',
    file: 'app/barbershops/[slug]/public-barbershop-page-final.tsx',
    test: (source) =>
      source.includes("searchParams.get('review_token')") &&
      source.includes("searchParams.delete('review_token')") &&
      source.includes('reviewToken ? (') &&
      source.includes('review_token: reviewToken'),
  },
  {
    name: 'Public review inserts are restricted to the validated RPC',
    file: 'supabase/migrations/20261016100000_harden_public_reviews_insert.sql',
    test: (source) =>
      source.includes('drop policy if exists "reviews_public_insert" on public.reviews') &&
      source.includes('revoke insert, update, delete on public.reviews from anon, authenticated') &&
      source.includes('submit_public_review'),
  },
  {
    name: 'Development origins are not enabled in production',
    file: 'next.config.ts',
    test: (source) =>
      source.includes("process.env.NODE_ENV === 'development'") &&
      source.includes("      : [],"),
  },
];

let failed = 0;
for (const check of checks) {
  try {
    const source = await read(check.file);
    const ok = check.test(source);
    if (!ok) {
      failed += 1;
      console.error(`FAIL ${check.name}`);
    } else {
      console.log(`PASS ${check.name}`);
    }
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

if (failed > 0) {
  console.error(`\n${failed} product contract check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} product contract checks passed.`);
