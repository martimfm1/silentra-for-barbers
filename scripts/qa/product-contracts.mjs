import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

async function read(path) {
  return readFile(resolve(root, path), 'utf8');
}

const checks = [
  {
    name: 'Legacy booking availability and staff rescheduling use linked service capacity',
    file: 'app/api/shops/[id]/booking-data/route.ts',
    test: (source) =>
      source.includes("services(duration,buffer_minutes)") &&
      source.includes('getReservedAppointmentMinutes(appointment)'),
  },
  {
    name: 'Customer portal availability uses linked service capacity for legacy appointments',
    file: 'app/api/customer-portal/appointments/[appointmentId]/route.ts',
    test: (source) =>
      source.includes('getReservedAppointmentMinutes(appointment)') &&
      source.includes('getReservedAppointmentMinutes(item)'),
  },
  {
    name: 'Manual and recurring appointments snapshot the selected service duration and buffer',
    file: 'app/dashboard/_services/appointments.service.ts',
    test: (source) =>
      source.includes('getServiceCapacitySnapshots') &&
      source.includes(".select('id,duration,buffer_minutes')") &&
      source.includes('duration_minutes: capacity.duration_minutes') &&
      source.includes('buffer_minutes: capacity.buffer_minutes') &&
      source.includes('payloads.map((payload) => {'),
  },
  {
    name: 'Public profile resolution fails closed when the canonical plan lookup is unavailable',
    file: 'lib/barbershops/public-profile.ts',
    test: (source) =>
      source.includes('plan: BillingPlan | null') &&
      source.includes('plan: null') &&
      source.includes('if (!plan) return null;') &&
      source.includes(': null;'),
  },
  {
    name: 'Public booking page layout is selected from the effective subscription plan',
    file: 'app/barbershops/[slug]/page.tsx',
    test: (source) =>
      source.includes("profile.plan === 'pro'") &&
      source.includes("profile.plan === 'enterprise' && bookingMode") &&
      source.includes('initialData.landing_page_url') &&
      source.includes('<ProBookingPage') &&
      source.includes('<BarbershopPublicPage'),
  },
  {
    name: 'Pro booking layout reuses the secure booking drawer and supports closed days',
    file: 'app/barbershops/[slug]/pro-booking-page.tsx',
    test: (source) =>
      source.includes('BookingDrawer') &&
      source.includes('appearance="agenda"') &&
      source.includes('selectedServiceId={selectedServiceId}') &&
      source.includes('closed_days: closedDays ?? null') &&
      source.includes("t('proBookingPage.services')"),
  },
  {
    name: 'Enterprise landing-page booking CTA opens the direct booking variant',
    file: 'app/site/[slug]/page.tsx',
    test: (source) =>
      source.includes('?booking=1') &&
      source.includes(
        "'/barbershops/' + encodeURIComponent(website.booking_slug)",
      ),
  },
  {
    name: 'Enterprise custom website includes Silentra domain and a one-time €50 fee',
    file: 'app/api/dashboard/custom-website/route.ts',
    test: (source) =>
      source.includes('setupFee: 50') && source.includes('monthlyFee: 0'),
  },
  {
    name: 'Enterprise website request displays the included Silentra domain and one-time activation',
    file: 'app/dashboard/website/page.tsx',
    test: (source) =>
      source.includes('barbers.silentra.me/') &&
      source.includes('pagamento único') &&
      source.includes('Sem mensalidade adicional.') &&
      source.includes('href={`/${encodeURIComponent(latest.public_slug)}`}'),
  },
  {
    name: 'Silveira Salon reuses the shared Pro booking layout',
    file: 'app/agendadovictor/agenda-do-victor-page.tsx',
    test: (source) =>
      source.includes('ProBookingPage') &&
      source.includes('<ProBookingPage') &&
      source.includes('profile={profile}') &&
      source.includes('services={services}') &&
      source.includes('closedDays={shop.closed_days}'),
  },
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
    name: 'Team invite v2 supports expiring code, link and QR tokens with revocation',
    file: 'supabase/migrations/20261117120000_rework_team_invites_with_links_and_qr.sql',
    test: (source) =>
      source.includes('create_barbershop_invite_v2') &&
      source.includes("p_method not in ('code', 'link', 'qr')") &&
      source.includes("v_value := 'SIL-'") &&
      source.includes('gen_random_bytes(16)') &&
      source.includes('revoked_at is null') &&
      source.includes('revoke_barbershop_invite'),
  },
  {
    name: 'Team invite API creates, lists and revokes invitations',
    file: 'app/api/team/invite/route.ts',
    test: (source) =>
      /\.rpc\(\s*['"]create_barbershop_invite_v2['"]/.test(source) &&
      source.includes("from('barbershop_invite_codes')") &&
      /\.rpc\(\s*['"]revoke_barbershop_invite['"]/.test(source) &&
      source.includes("export const GET") &&
      source.includes("export const DELETE"),
  },
  {
    name: 'Team invitation UI supports code, link sharing and QR downloads',
    file: 'app/dashboard/_components/team/InviteCodeCard.tsx',
    test: (source) =>
      source.includes("useState<InviteMethod>('link')") &&
      source.includes("QRCode.toDataURL") &&
      source.includes('navigator.share') &&
      source.includes('download="silentra-convite-equipa.png"') &&
      source.includes("method: 'DELETE'"),
  },
  {
    name: 'Onboarding pre-fills invitation links and accepts secure SIL tokens',
    file: 'app/onboarding/page.tsx',
    test: (source) =>
      source.includes("params.get('invite')") &&
      source.includes("cleaned.startsWith('SIL')") &&
      source.includes('maxLength={46}'),
  },
  {
    name: 'Current invite generator samples only from the accepted 32-character alphabet',
    file: 'supabase/migrations/20261116232318_fix_invite_code_charset.sql',
    test: (source) =>
      source.includes("v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'") &&
      source.includes('get_byte(gen_random_bytes(1), 0)') &&
      source.includes('The alphabet has 32 symbols') &&
      source.includes('v_random_byte % length(v_alphabet)') &&
      source.includes("v_code := 'BARB-'") &&
      !source.includes("encode(gen_random_bytes(6), 'hex')"),
  },
  {
    name: 'Onboarding API accepts new and already-issued hexadecimal BARB codes',
    file: 'app/api/onboarding/join-v2/route.ts',
    test: (source) =>
      source.includes('const INVITE_BODY = /^(?:[0-9A-HJ-NP-Z]{8}|[0-9A-HJ-NP-Z]{12})$/;') &&
      source.includes('INVITE_BODY.test(body)'),
  },
  {
    name: 'Invite-code UI validates long BARB codes and secure SIL link tokens',
    file: 'app/dashboard/_components/team/InviteCodeCard.tsx',
    test: (source) =>
      source.includes('const INVITE_CODE_PATTERN =') &&
      source.includes('BARB-(?:[0-9A-HJ-NP-Z]{4}-){2}') &&
      source.includes('const LINK_TOKEN_PATTERN = /^SIL-[0-9A-F]{32}$/'),
  },
  {
    name: 'Canonical onboarding join API accepts new invite links and QR tokens',
    file: 'app/api/onboarding/join-v2/route.ts',
    test: (source) =>
      source.includes('const LINK_TOKEN = /^[0-9A-F]{32}$/') &&
      source.includes("compact.startsWith('SIL')") &&
      source.includes('[0-9A-HJ-NP-Z]{12}') &&
      source.includes('LEGACY_INVITE_CODE'),
  },
  {
    name: 'Invite links survive the unauthenticated onboarding redirect',
    file: 'lib/supabase/proxy.ts',
    test: (source) =>
      source.includes("loginUrl.searchParams.set(") &&
      source.includes("`${pathname}${request.nextUrl.search}`"),
  },
  {
    name: 'Invite destination survives registration and email confirmation safely',
    file: 'lib/auth/email-confirmation.ts',
    test: (source) =>
      source.includes('sanitizeInviteRedirect') &&
      source.includes("target.pathname !== '/onboarding'") &&
      source.includes('INVITE_LINK_TOKEN') &&
      source.includes('callback.searchParams.set(\'next\', safeNext)'),
  },
  {
    name: 'Signup and resend-confirmation flows carry the validated invitation destination',
    file: 'app/api/auth/register/route.ts',
    test: (source) =>
      source.includes('sanitizeInviteRedirect(body.redirect)') &&
      source.includes('getAuthCallbackUrl('),
  },
  {
    name: 'Auth callback only accepts a validated invite onboarding redirect',
    file: 'app/api/auth/callback/route.ts',
    test: (source) =>
      source.includes('sanitizeInviteRedirect(value)') &&
      source.includes("'/email-confirmed'"),
  },
  {
    name: 'Onboarding join RPC preserves compatibility with issued hexadecimal BARB invites',
    file: 'supabase/migrations/20261116232318_fix_invite_code_charset.sql',
    test: (source) =>
      source.includes("v_input ~ '^BARB-[0-9A-HJ-NP-Z]{4}-[0-9A-HJ-NP-Z]{4}$'") &&
      source.includes("v_input ~ '^[0-9A-F]{10}$'") &&
      source.includes('revoke all on function public.join_barbershop_with_invite(text)') &&
      source.includes('grant execute on function public.join_barbershop_with_invite(text)'),
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
    name: 'Branding uploads identify image formats from file signatures instead of trusting browser MIME labels',
    file: 'lib/utils/upload-image.ts',
    test: (source) =>
      source.includes('detectImageMime(file)') &&
      source.includes('file.slice(0, 64)') &&
      source.includes("return 'image/jpeg'") &&
      source.includes("return 'image/webp'") &&
      source.includes("detectedType === 'image/heic'") &&
      !source.includes('SUPPORTED_IMAGE_TYPES.has(file.type)'),
  },
  {
    name: 'Branding uploads use an authenticated server-side WebP fallback when browser encoding is unavailable',
    file: 'lib/utils/upload-image.ts',
    test: (source) =>
      source.includes("'/api/barbershops/image-convert'") &&
      source.includes('MAX_SERVER_CONVERSION_BYTES') &&
      source.includes("encodeCanvas(canvas, 'image/png', 1)") &&
      /encodeCanvas\(\s*jpegCanvas,\s*'image\/jpeg',\s*candidate,?\s*\)/.test(
        source,
      ),
  },
  {
    name: 'Server-side branding conversion validates tenant access, payload size and image signatures before using Sharp',
    file: 'app/api/barbershops/image-convert/route.ts',
    test: (source) =>
      source.includes(
        "requireTenantAuthorization(request, ['owner', 'admin'])",
      ) &&
      source.includes('consumePublicRateLimit') &&
      source.includes('MAX_IMAGE_BYTES') &&
      source.includes('metadata.format !== expectedFormat') &&
      source.includes('.webp({ quality: 85, effort: 4 })'),
  },
  {
    name: 'Dashboard branding uploads remain pending until the global settings save',
    file: 'app/dashboard/settings/settings-page.tsx',
    test: (source) =>
      source.includes('setPendingAvatar(file)') &&
      source.includes('setPendingBanner(file)') &&
      source.includes('pendingAvatar !== null') &&
      source.includes('pendingBanner !== null') &&
      source.includes("bucket: 'avatar'") &&
      source.includes("bucket: 'banner'") &&
      source.includes('if (result.error || !result.data?.publicUrl)') &&
      source.includes('setAvatarDraftUrl(null)') &&
      source.includes('setBannerDraftUrl(null)'),
  },
  {
    name: 'Periodic report windows respect configured closing times and Europe Lisbon daylight saving changes',
    file: 'lib/analytics/periodic-reports.ts',
    test: (source) =>
      source.includes('getClosedReportPeriods') &&
      source.includes("const ZONE = 'Europe/Lisbon'") &&
      source.includes('closingInstant') &&
      source.includes('periodHasClosed') &&
      source.includes('previousStartAt'),
  },
  {
    name: 'Periodic reports are tenant-authorized, generated once after close and stored for history',
    file: 'app/api/periodic-reports/route.ts',
    test: (source) =>
      source.includes("requireModuleContext(") &&
      source.includes("'basic_dashboard'") &&
      source.includes('barbershop_period_reports') &&
      source.includes('getClosedReportPeriods') &&
      source.includes("onConflict: 'barbershop_id,period_type,period_start'") &&
      source.includes('unreadReports') &&
      source.includes('viewed_at') &&
      source.includes('pointOfSaleRevenue') &&
      source.includes('service_price') &&
      source.includes('function servicePrice'),
  },
  {
    name: 'Dashboard closing summaries include revenue, retention, cancellations and actionable insights',
    file: 'components/dashboard/periodic-business-reports.tsx',
    test: (source) =>
      source.includes('DashboardClosingReports') &&
      source.includes('PeriodReportsHistory') &&
      source.includes('cancellationRate') &&
      source.includes('rebookingRate') &&
      source.includes('topService') &&
      source.includes('bestRevenueDay') &&
      source.includes('pointOfSaleRevenue') &&
      source.includes('Mostrar mais resumos') &&
      source.includes("method: 'PATCH'"),
  },
  {
    name: 'Periodic report snapshots are tenant-scoped and inaccessible directly to browser roles',
    file: 'supabase/migrations/20261128230000_barbershop_period_reports.sql',
    test: (source) =>
      source.includes('barbershop_id uuid not null') &&
      source.includes('unique (barbershop_id, period_type, period_start)') &&
      source.includes('enable row level security') &&
      source.includes('revoke all on public.barbershop_period_reports from anon, authenticated') &&
      source.includes('grant all on public.barbershop_period_reports to service_role'),
  },
  {
    name: 'Reports page separates service revenue from product sales and supports client rebooking analysis',
    file: 'app/dashboard/analytics/page.tsx',
    test: (source) =>
      source.includes('data.overview.serviceRevenue') &&
      source.includes('data.overview.productRevenue') &&
      source.includes('data.overview.rebookingRate') &&
      source.includes('buildRevenueSeries') &&
      source.includes('aria-pressed={preset === value}') &&
      source.includes("title={t('analyticsPage.bookingsReport')}") &&
      !source.includes('title="{t(\'analyticsPage.bookingsReport\')}"'),
  },
  {
    name: 'Analytics API returns service and product revenue separately and calculates future rebooking',
    file: 'app/api/analytics/route.ts',
    test: (source) =>
      source.includes('payment_method') &&
      source.includes('serviceRevenue: money(serviceRevenue)') &&
      source.includes('productRevenue: money(productRevenue)') &&
      source.includes('rebookingRate:') &&
      source.includes(".gt('date_hour', to.toISOString())") &&
      source.includes(".in('status', ['pending', 'scheduled'])"),
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
    file: 'supabase/migrations/20261013173924_marketplace_product_publication_boost.sql',
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
      source.includes(
        '/api/marketplace/products?id=${encodeURIComponent(productId)}',
      ) &&
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
    file: 'supabase/migrations/20261017104155_marketplace_order_tracking_capabilities.sql',
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
    name: 'Custom website requests enforce Enterprise entitlement or an explicit Free/Pro grant',
    file: 'app/api/dashboard/custom-website/route.ts',
    test: (source) =>
      source.includes("plan === 'enterprise'") &&
      source.includes("from('custom_website_access_grants')") &&
      source.includes("eq('active', true)") &&
      source.includes('RESERVED_SLUGS') &&
      source.includes('12_000') &&
      source.includes("from('custom_website_requests')") &&
      source.includes('context.user.id'),
  },
  {
    name: 'Custom website public route only renders explicitly published paths',
    file: 'app/[slug]/page.tsx',
    test: (source) =>
      source.includes("eq('status', 'published')") &&
      source.includes("eq('public_slug', slug)") &&
      source.includes('notFound()') &&
      source.includes('booking_slug'),
  },
  {
    name: 'Admin website publication requires a unique valid public path and site metadata',
    file: 'app/api/silentra-admin/custom-websites/[requestId]/route.ts',
    test: (source) =>
      source.includes('requirePlatformAdmin()') &&
      source.includes('RESERVED_SLUGS') &&
      source.includes("nextStatus === 'published'") &&
      source.includes('nextSlug') &&
      source.includes('23505'),
  },
  {
    name: 'Custom website workflow is visible in Enterprise plan and customer dashboard',
    file: 'lib/billing/plan-features.ts',
    test: (source) =>
      source.includes("'custom_website'") &&
      source.includes(
        "custom_website: 'Site próprio no domínio Silentra (ativação única de 50 €)'",
      ) &&
      source.includes("'custom_website',"),
  },
  {
    name: 'Enterprise checkout directs bespoke website requests to direct contact',
    file: 'app/checkout/page.tsx',
    test: (source) =>
      source.includes("intent.plan === 'enterprise'") &&
      source.includes('mailto:contact.silentra@gmail.com') &&
      source.includes('pagamento único)') &&
      source.includes('one-time €50 fee') &&
      source.includes('domínio Silentra') &&
      source.includes('no extra monthly charge'),
  },
  {
    name: 'Custom website requests are protected by a service-role-only database table',
    file: 'supabase/migrations/20261017103519_enterprise_custom_website_requests.sql',
    test: (source) =>
      source.includes('custom_website_requests') &&
      source.includes('enable row level security') &&
      source.includes('revoke all') &&
      source.includes(
        'grant all on public.custom_website_requests to service_role',
      ) &&
      source.includes('custom_website_requests_public_slug_unique'),
  },
  {
    name: 'Customer booking drawer resets each step to the top and supports safe-area mobile scrolling',
    file: 'app/barbershops/components/booking-drawer-canonical.tsx',
    test: (source) =>
      source.includes('scrollAreaRef') &&
      source.includes("scrollTo({ top: 0, behavior: 'auto' })") &&
      source.includes('data-booking-scroll-area') &&
      source.includes('touch-pan-y') &&
      source.includes('overscroll-contain') &&
      source.includes('safe-area-inset-bottom') &&
      source.includes('h-[min(90svh,48rem)]'),
  },
  {
    name: 'Stripe webhook ledger stores sanitized failure identifiers only',
    file: 'app/api/stripe/webhook/route.ts',
    test: (source) => {
      const start = source.indexOf('async function markWebhookFailed');
      const end = source.indexOf(
        'async function hydrateBillingMappingFromMetadata',
      );
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
      source.includes('database.rpc(') &&
      source.includes("'submit_public_review_with_token'") &&
      source.includes("createHash('sha256')") &&
      !source.includes("from('reviews')"),
  },
  {
    name: 'Public reviews require a single-use token tied to a completed appointment',
    file: 'supabase/migrations/20261017103513_verified_review_submission_tokens.sql',
    test: (source) =>
      source.includes('review_submission_tokens') &&
      source.includes("a.status = 'completed'::public.appointment_status") &&
      source.includes('t.consumed_at is null') &&
      source.includes('t.expires_at > now()') &&
      source.includes('length(p_token_hash) <> 64') &&
      source.includes(
        "translate(p_token_hash, '0123456789abcdef', '') <> ''",
      ) &&
      source.includes('set consumed_at = now()') &&
      source.includes('submit_public_review_with_token') &&
      source.includes(
        'revoke all on function public.submit_public_review(uuid, text, integer, text)',
      ),
  },
  {
    name: 'Completed booking issues a hashed, expiring review capability',
    file: 'app/api/appointments/[appointmentId]/complete/route.ts',
    test: (source) =>
      source.includes("randomBytes(32).toString('base64url')") &&
      source.includes("createHash('sha256')") &&
      source.includes("from('review_submission_tokens')") &&
      source.includes("searchParams.set('token', reviewToken)") &&
      source.includes('/review/claim') &&
      source.includes('expires_at'),
  },
  {
    name: 'Every public barbershop has a dedicated no-index review page',
    file: 'app/barbershops/[slug]/review/page.tsx',
    test: (source) =>
      source.includes('getPublicProfileBySlug') &&
      source.includes('PublicReviewForm') &&
      source.includes('reviewAccessCookieName') &&
      source.includes('index: false') &&
      source.includes('follow: false'),
  },
  {
    name: 'Public review links are exchanged for shop-scoped HttpOnly cookies',
    file: 'app/barbershops/[slug]/review/claim/route.ts',
    test: (source) =>
      source.includes('getPublicProfileBySlug') &&
      source.includes('REVIEW_TOKEN_PATTERN') &&
      source.includes('httpOnly: true') &&
      source.includes("sameSite: 'lax'") &&
      source.includes('reviewTokenCookieName') &&
      source.includes('reviewAccessCookieName') &&
      source.includes("path: '/api/public/reviews'") &&
      source.includes("response.headers.set('Referrer-Policy', 'no-referrer')"),
  },
  {
    name: 'Legacy booking-completed automations cannot send a duplicate review request',
    file: 'lib/automations/dispatch-appointment.ts',
    test: (source) =>
      source.includes(
        "import { isReviewRequestContent } from '@/lib/reviews/is-review-request'",
      ) &&
      /trigger === 'booking_completed'\s*&&\s*isReviewRequestContent\(subject,\s*body\)/.test(
        source,
      ) &&
      /if\s*\(\s*trigger === 'booking_completed'\s*&&\s*isReviewRequestContent\(subject,\s*body\)\s*\)\s*\{\s*continue;\s*\}/.test(
        source,
      ) &&
      source.includes('dedicated, single-use review flow'),
  },
  {
    name: 'Event marketing campaigns cannot send duplicate review emails',
    file: 'lib/marketing/dispatcher.ts',
    test: (source) =>
      source.includes('isReviewRequestContent(') &&
      source.includes("campaign.channel === 'email'") &&
      source.includes("campaign.event_name === 'booking_completed'") &&
      source.includes("status: 'skipped'") &&
      source.includes('dedicated review email'),
  },
  {
    name: 'Marketplace cards link to a dedicated reviews page',
    file: 'app/barbershops/components/shop-card.tsx',
    test: (source) =>
      source.includes('/reviews') &&
      source.includes('directory.viewReviews') &&
      source.includes('MessageSquareText'),
  },
  {
    name: 'Public reviews page supports search, rating filters and sorting',
    file: 'app/barbershops/[slug]/reviews/public-reviews-page.tsx',
    test: (source) =>
      source.includes('ratingFilter') &&
      source.includes('withCommentOnly') &&
      source.includes("sort === 'highest'") &&
      source.includes("sort === 'lowest'") &&
      source.includes('reviews.filter(') &&
      source.includes('distribution'),
  },
  {
    name: 'Anonymous review form only accepts a 1-5 star rating and optional comment',
    file: 'app/barbershops/[slug]/review/ReviewForm.tsx',
    test: (source) =>
      source.includes('[1, 2, 3, 4, 5]') &&
      source.includes('hasReviewAccess') &&
      source.includes("credentials: 'same-origin'") &&
      source.includes('No account required') &&
      source.includes('review') &&
      !source.includes('reviewToken:'),
  },
  {
    name: 'Public review submission uses same-origin, an HttpOnly token, rate limits and a honeypot',
    file: 'app/api/public/reviews/route.ts',
    test: (source) =>
      source.includes('assertSameOrigin(request)') &&
      source.includes('await cookies()') &&
      source.includes('reviewTokenCookieName') &&
      source.includes('consumePublicRateLimit(') &&
      source.includes('REVIEW_RATE_LIMIT = 5') &&
      source.includes('database.rpc(') &&
      source.includes("'submit_public_review_with_token'") &&
      source.includes("createHash('sha256')") &&
      source.includes('body.website') &&
      !source.includes('clientName') &&
      !source.includes("from('reviews')"),
  },
  {
    name: 'Review RPC derives the display name from the completed appointment and works for hidden directory listings',
    file: 'supabase/migrations/20261106001846_20261106110000_harden_dedicated_public_reviews.sql',
    test: (source) =>
      source.includes("a.status = 'completed'::public.appointment_status") &&
      source.includes('t.consumed_at is null') &&
      source.includes('t.expires_at > now()') &&
      source.includes('for update of t') &&
      source.includes('a.manual_name') &&
      source.includes('u.name_complete') &&
      source.includes('s.public_profile_enabled') &&
      !source.includes('is_public_in_directory'),
  },
  {
    name: 'Public review inserts are restricted to the validated RPC',
    file: 'supabase/migrations/20261017103432_harden_public_reviews_insert.sql',
    test: (source) =>
      source.includes(
        'drop policy if exists "reviews_public_insert" on public.reviews',
      ) &&
      source.includes(
        'revoke insert, update, delete on public.reviews from anon, authenticated',
      ) &&
      source.includes('submit_public_review'),
  },
  {
    name: 'Public booking creation respects automatic confirmation instead of confirming every booking',
    file: 'app/api/bookings/route.ts',
    test: (source) =>
      source.includes(
        "p_status: isPrepayment ? 'prepayment_pending' : 'pending'",
      ) &&
      source.includes("if (appointment.status === 'scheduled')") &&
      source.includes('else if (!isPrepayment)') &&
      source.includes('prepaymentReview') &&
      source.includes('sendBrevoEmail({') &&
      source.includes('A marcação ainda não está confirmada.') &&
      source.includes('Aguarda a confirmação da barbearia.'),
  },
  {
    name: 'Marketing cron schedules birthday campaigns and queued delivery',
    file: 'app/api/cron/marketing/route.ts',
    test: (source) =>
      source.includes('processBirthdayCampaignDelivery') &&
      source.includes('processQueuedCampaignRecipients') &&
      source.includes('processScheduledCampaigns'),
  },
  {
    name: 'Marketing worker is scheduled through Supabase Cron with the Vault HMAC secret',
    file: 'supabase/migrations/20261122140747_schedule_marketing_cron.sql',
    test: (source) =>
      source.includes("'silentra-marketing'") &&
      source.includes("'*/5 * * * *'") &&
      source.includes('silentra_booking_outbox_cron_secret') &&
      source.includes('silentra_booking_outbox_url') &&
      source.includes('x-marketing-signature') &&
      source.includes("signing.ts || ':marketing'"),
  },
  {
    name: 'Published custom websites are included in the sitemap',
    file: 'app/sitemap.ts',
    test: (source) =>
      source.includes("from('custom_website_requests')") &&
      source.includes(".eq('status', 'published')") &&
      source.includes('customWebsiteRoutes.push') &&
      source.includes('/site/'),
  },
  {
    name: 'Custom website publication prevents collisions with existing public profile slugs',
    file: 'app/api/silentra-admin/custom-websites/[requestId]/route.ts',
    test: (source) =>
      source.includes("from('shops')") &&
      source.includes(".eq('slug', nextSlug)") &&
      source.includes('Esse caminho já é utilizado pelo perfil público'),
  },
  {
    name: 'Custom website publishing sets and clears publication timestamp',
    file: 'app/api/silentra-admin/custom-websites/[requestId]/route.ts',
    test: (source) =>
      source.includes('update.published_at = new Date().toISOString()') &&
      source.includes('update.published_at = null') &&
      source.includes("nextStatus === 'published'"),
  },
  {
    name: 'Automatic booking completion does not update a non-existent appointments.updated_at column',
    file: 'supabase/migrations/20261022144928_fix_automatic_booking_completion_updated_at.sql',
    test: (source) =>
      source.includes("set status = 'completed'") &&
      source.includes('public.process_automatic_booking_completion()') &&
      !source.includes('updated_at = now()'),
  },
  {
    name: 'Automatic booking completion has a ten-minute Supabase Cron job',
    file: 'supabase/migrations/20260827180000_schedule_booking_completion_with_pg_cron.sql',
    test: (source) =>
      source.includes("'silentra-booking-completion'") &&
      source.includes("'*/10 * * * *'") &&
      source.includes('public.process_automatic_booking_completion()'),
  },
  {
    name: 'Development origins are not enabled in production',
    file: 'next.config.ts',
    test: (source) =>
      source.includes("process.env.NODE_ENV === 'development'") &&
      source.includes('      : [],'),
  },

  {
    name: 'Agenda do Victor is tenant-bound and requires an effective paid plan',
    file: 'app/agendadovictor/page.tsx',
    test: (source) =>
      source.includes('getPublicProfileBySlug(SLUG)') &&
      source.includes(
        "profile.barbershop_id !== 'f9cf1bca-22ec-4782-87ca-c338d51fc30d'",
      ) &&
      source.includes("!['pro', 'enterprise'].includes(profile.plan)") &&
      source.includes("if (profile.plan === 'enterprise')") &&
      source.includes("permanentRedirect('/site/'") &&
      source.includes(".eq('barbershop_id', profile.barbershop_id)"),
  },
  {
    name: 'Agenda do Victor delegates to the shared Pro booking template',
    file: 'app/agendadovictor/agenda-do-victor-page.tsx',
    test: (source) =>
      source.includes('ProBookingPage') &&
      source.includes('<ProBookingPage') &&
      source.includes('openingTime={shop.opening_time}') &&
      source.includes('closedDays={shop.closed_days}'),
  },
  {
    name: 'Agenda do Victor enables the dedicated OG-inspired banner booking hero',
    file: 'app/agendadovictor/agenda-do-victor-page.tsx',
    test: (source) =>
      source.includes('agendaHeroLayout') &&
      source.includes('hideClosedDays') &&
      source.includes('requireBirthDate={false}'),
  },
  {
    name: 'Agenda do Victor desktop hero darkens the uploaded banner and places services beside the title without a booking badge',
    file: 'app/barbershops/[slug]/pro-booking-page.tsx',
    test: (source) =>
      source.includes('agendaHeroLayout?: boolean') &&
      source.includes('agendaHeroLayout = false') &&
      source.includes('hidden min-h-dvh') &&
      source.includes('bg-cover bg-center') &&
      source.includes('rgba(0,0,0,.84)') &&
      source.includes('grid-cols-[minmax(0,.88fr)_minmax(520px,1.12fr)]') &&
      source.includes('Escolhe o teu serviço') &&
      source.includes('Choose your service') &&
      !source.includes('Agendamento online') &&
      !source.includes('Online booking') &&
      source.includes('onClick={() => openBooking(service.id)}') &&
      source.includes('<BookingDrawer'),
  },
  {
    name: 'Agenda do Victor mobile restores the centered banner and light overlapping services card',
    file: 'app/barbershops/[slug]/pro-booking-page.tsx',
    test: (source) =>
      source.includes('lg:bg-[#09090b]') &&
      source.includes('lg:hidden') &&
      source.includes('min-h-[250px]') &&
      source.includes('items-center justify-center') &&
      source.includes('text-center') &&
      source.includes('max-w-3xl') &&
      source.includes('-mt-7') &&
      source.includes('bg-white') &&
      source.includes("t('proBookingPage.eyebrow')") &&
      source.includes("t('proBookingPage.title')") &&
      source.includes("t('proBookingPage.services')"),
  },
  {
    name: 'Agenda do Victor is the canonical public page for the Silveira Salon account',
    file: 'app/barbershops/[slug]/page.tsx',
    test: (source) =>
      source.includes(
        'profile.barbershop_id === AGENDA_DO_VICTOR_BARBERSHOP_ID',
      ) &&
      source.includes("permanentRedirect('/agendadovictor')") &&
      source.includes("? '/agendadovictor'"),
  },
  {
    name: 'Agenda do Victor replaces the old shop URL in the public sitemap',
    file: 'app/sitemap.ts',
    test: (source) =>
      source.includes('url: `${SITE_URL}/agendadovictor`') &&
      source.includes('slug === AGENDA_DO_VICTOR_SHOP_SLUG'),
  },
  {
    name: 'Agenda do Victor passes barbershop closed weekdays to the booking drawer',
    file: 'app/agendadovictor/page.tsx',
    test: (source) =>
      source.includes(".select('opening_time,closing_time,closed_days,time_limit_cancellation_hours,minimum_booking_notice_minutes')") &&
      source.includes('closed_days: hours.closed_days') &&
      source.includes('time_limit_cancellation_hours: hours.time_limit_cancellation_hours') &&
      source.includes('minimum_booking_notice_minutes: hours.minimum_booking_notice_minutes'),
  },
  {
    name: 'Shared Pro booking drawer uses the light theme and preserves closed days',
    file: 'app/barbershops/[slug]/pro-booking-page.tsx',
    test: (source) =>
      source.includes('appearance="agenda"') &&
      source.includes('closed_days: closedDays ?? null') &&
      source.includes('shop={bookingShop}'),
  },
  {
    name: 'Booking drawer requires a complete verified availability overview before selecting a day',
    file: 'app/barbershops/components/booking-drawer-canonical.tsx',
    test: (source) => {
      const normalized = source.replace(/\s+/g, ' ').trim();
      return (
        normalized.includes('const availableDays = days;') &&
        normalized.includes('currentDayClosed = currentDay ? isDayOffForBookingDay(currentDay) || dayAvailability[currentDay.dateStr]?.closedDay === true : false') &&
        normalized.includes('const [verifiedDayAvailabilityKey, setVerifiedDayAvailabilityKey] = useState<string | null>(null)') &&
        normalized.includes('dayAvailabilityReady = verifiedDayAvailabilityKey === dayAvailabilityRequestKey') &&
        normalized.includes('dayAvailabilityRequestKey = [') &&
        normalized.includes("days[days.length - 1]?.dateStr ?? ''") &&
        normalized.includes('setVerifiedDayAvailabilityKey(dayAvailabilityRequestKey)') &&
        normalized.includes('setVerifiedDayAvailabilityKey(null)') &&
        normalized.includes('days.every((day) => {') &&
        normalized.includes('typeof status.available === \'boolean\'') &&
        normalized.includes('typeof status.closedDay === \'boolean\'') &&
        normalized.includes('!dayAvailabilityReady &&') &&
        normalized.includes('disabled={dayStatus.disabled}') &&
        normalized.includes('dayStatus.needsService') &&
        normalized.includes('Choose a service first to check which days have openings.') &&
        normalized.includes('Availability has not been fully verified yet. Please retry.') &&
        normalized.includes('Could not verify availability for every day.') &&
        normalized.includes('!dayAvailabilityError') &&
        normalized.includes('!dayAvailabilityReady ||') &&
        normalized.includes('setRetryKey((value) => value + 1)') &&
        normalized.includes("t('bookingDrawer.retry')") &&
        normalized.includes('const nextOpenIndex = days.findIndex(') &&
        normalized.includes("availabilityOverview: '1'") &&
        normalized.includes('dayAvailability[day.dateStr]?.available === true') &&
        normalized.includes("'Sem vagas'") &&
        normalized.includes('A vermelho: dia de folga ou sem horários disponíveis') &&
        normalized.includes('booking-data?date=') &&
        normalized.includes('professional.id') &&
        normalized.includes('setSelectedDayClosed(responseData.closedDay === true)') &&
        normalized.includes('setSelectedDayClosed(cached.data.closedDay === true)') &&
        normalized.includes('selectedDayClosed') &&
        normalized.includes('O barbeiro está de folga neste dia.') &&
        normalized.includes('Escolhe outro dia para veres os horários disponíveis.') &&
        normalized.includes('data-booking-theme={appearance}') &&
        source.indexOf('bookingDrawer.stepThreeService') <
          source.indexOf('bookingDrawer.stepTwoDay') &&
        source.includes(
          'Select a service so we can check which days still have openings.',
        ) &&
        source.includes("value={serviceId ?? ''}") &&
        source.includes('item.durationMinutes')
      );
    },
  },
  {
    name: 'Booking calendar availability overview checks 14 days using live booking constraints',
    file: 'app/api/shops/[id]/booking-data/route.ts',
    test: (source) =>
      source.includes("searchParams.get('availabilityOverview') === '1'") &&
      source.includes('addDaysToDate(date, 13)') &&
      source.includes(".gte('date', date)") &&
      source.includes('.lte(\'date\', availabilityEndDate)') &&
      source.includes("`${availabilityEndDate}T23:59:59`") &&
      source.includes('appointmentsShareProfessionalCapacity') &&
      source.includes('isBeforeMinimumBookingNotice') &&
      source.includes('dayAvailability'),
  },
  {
    name: 'Marketplace availability uses shop defaults and per-barber weekly schedules',
    file: 'app/api/shops/route.ts',
    test: (source) =>
      source.includes('weekly_schedule, is_public_in_directory') &&
      source.includes('professional.weekly_schedule') &&
      source.includes('normalizeWeeklySchedule') &&
      source.includes('getDailySchedule') &&
      source.includes('isSlotWithinDailySchedule') &&
      source.includes('professionalsByShop'),
  },
  {
    name: 'Public booking drawer displays the selected workday end as a non-selectable schedule note',
    file: 'app/barbershops/components/booking-drawer-canonical.tsx',
    test: (source) =>
      source.includes('currentProfessionalSchedule') &&
      source.includes('getDailySchedule(') &&
      source.includes('currentDayWorkEnd') &&
      source.includes('work_intervals.reduce<string | null>') &&
      source.includes('Fim do horário de trabalho') &&
      source.includes('Workday ends at') &&
      source.includes('role="note"') &&
      source.includes('dateTime={currentDayWorkEnd}'),
  },
  {
    name: 'iCalendar feed tokens are purpose-scoped and timing-safe verified',
    file: 'lib/calendar/feed-token.ts',
    test: (source) =>
      source.includes('timingSafeEqual') &&
      source.includes('RATE_LIMIT_SECRET') &&
      source.includes('silentra:barbershop-calendar-feed:'),
  },
  {
    name: 'Private iCalendar feed shows customer and service labels without contact details',
    file: 'app/api/calendar/feed/route.ts',
    test: (source) =>
      source.includes(".eq('barbershop_id', payload.barbershopId)") &&
      source.includes(".in('status', ['pending', 'scheduled'])") &&
      source.includes('verifyBarbershopCalendarFeedToken') &&
      source.includes("from('schedule_blocks')") &&
      source.includes('lisbonLocalDateTime') &&
      source.includes('.range(offset, offset + appointmentPageSize - 1)') &&
      source.includes("'Referrer-Policy': 'no-referrer'") &&
      source.includes("'X-Robots-Tag': 'noindex, nofollow'") &&
      source.includes(
        'manual_name,users(name_complete,style_notes),services(name)',
      ) &&
      source.includes('const summary = `${clientName} - ${serviceName}`;') &&
      source.includes('notes:${clientNotes}') &&
      !source.includes('manual_phone') &&
      !source.includes('manual_email') &&
      !source.includes('num_phone'),
  },
  {
    name: 'Calendar subscription management checks agenda access and supports revocation',
    file: 'app/api/calendar/feed/settings/route.ts',
    test: (source) =>
      source.includes('hasAgendaGrant') &&
      source.includes('calendar_feed_version') &&
      source.includes('calendar_feed_enabled: false') &&
      source.includes('assertSameOrigin(request)') &&
      source.includes('export const POST') &&
      source.includes('export const DELETE'),
  },
  {
    name: 'Shared Radix dialogs use the Animate UI-inspired 3D entrance and quicker exit',
    file: 'app/globals.css',
    test: (source) =>
      source.includes('@keyframes silentra-dialog-enter') &&
      source.includes('@keyframes silentra-dialog-exit') &&
      source.includes("[data-slot='dialog-content'][data-state='open']") &&
      source.includes(
        "[data-slot='alert-dialog-content'][data-state='open']",
      ) &&
      source.includes('prefers-reduced-motion: reduce'),
  },
  {
    name: 'All shared modal overlays use progressive blur and a quick exit',
    file: 'app/globals.css',
    test: (source) =>
      source.includes('@keyframes silentra-modal-overlay-in') &&
      source.includes("[data-slot='sheet-overlay'][data-state='open']") &&
      source.includes("[data-slot='drawer-overlay'][data-state='open']"),
  },
  {
    name: 'Popover, dropdown, select and tooltip surfaces use the shared motion cadence',
    file: 'app/globals.css',
    test: (source) =>
      source.includes('@keyframes silentra-floating-enter') &&
      source.includes("[data-slot='popover-content'][data-state='open']") &&
      source.includes(
        "[data-slot='dropdown-menu-content'][data-state='open']",
      ) &&
      source.includes("[data-slot='select-content'][data-state='open']") &&
      source.includes(
        "[data-slot='tooltip-content'][data-state='delayed-open']",
      ),
  },
  {
    name: 'Contextual cursor-follow hint is spring animated, opt-in and touch-safe',
    file: 'components/ui/cursor-follow-hint.tsx',
    test: (source) =>
      source.includes('useMotionValue') &&
      source.includes('useSpring') &&
      source.includes("'(hover: hover) and (pointer: fine)'") &&
      source.includes("'[data-cursor-label]'") &&
      source.includes('prefersReducedMotion'),
  },
  {
    name: 'Dashboard appointment surfaces expose contextual cursor labels',
    file: 'components/dashboard/appointments-table.tsx',
    test: (source) =>
      source.includes('data-cursor-label=') &&
      source.includes('Open booking') &&
      source.includes('Ver marcação'),
  },
  {
    name: 'Dashboard iPhone calendar tutorial is localized, step-by-step and displayed in a dialog',
    file: 'components/dashboard/calendar-sync-card.tsx',
    test: (source) =>
      source.includes('/api/calendar/feed/settings') &&
      source.includes('navigator.clipboard.writeText') &&
      source.includes('onClick={() => setDialogOpen(true)}') &&
      source.includes(
        '<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>',
      ) &&
      source.includes('tutorialSteps.map') &&
      source.includes('calendarSyncStepFourDescription') &&
      source.includes('calendarSyncRotate') &&
      source.includes('calendarSyncDisable'),
  },
  {
    name: 'Silentra demo barbershop landing is bilingual, responsive and non-transactional',
    file: 'app/silentra/silentra-demo-barbershop.tsx',
    test: (source) =>
      source.includes('const PT =') &&
      source.includes('const EN =') &&
      source.includes('id="servicos"') &&
      source.includes('id="experiencia"') &&
      source.includes('id="equipa"') &&
      source.includes('id="marcacao"') &&
      source.includes('id="contactos"') &&
      source.includes('setSimulated(true)') &&
      source.includes('bookingDemo') &&
      source.includes("setLocale('pt')") &&
      source.includes("setLocale('en')") &&
      source.includes(
        'fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))]',
      ) &&
      source.includes('grid-cols-[1.02fr_0.98fr]') &&
      source.includes('aspect-[4/4.7]') &&
      source.includes('group-hover:scale-[1.04]') &&
      !source.includes('fetch(') &&
      !source.includes('/api/appointments'),
  },
  {
    name: 'Silentra demo barbershop is rendered by its public barbershop route with canonical metadata',
    file: 'app/site/[slug]/page.tsx',
    test: (source) =>
      source.includes(
        "SILENTRA_DEMO_PUBLIC_SLUG = 'barbearia-silentra-ecf1da6c'",
      ) &&
      source.includes('if (slug === SILENTRA_DEMO_PUBLIC_SLUG)') &&
      source.includes('return <SilentraDemoBarbershop />') &&
      source.includes(
        'alternates: { canonical: SITE_ORIGIN + canonicalPath }',
      ) &&
      source.includes('robots: { index: true, follow: true }'),
  },
  {
    name: 'Legacy /silentra route permanently redirects to the public barbershop page',
    file: 'app/silentra/page.tsx',
    test: (source) =>
      source.includes('permanentRedirect') &&
      source.includes("'/site/barbearia-silentra-ecf1da6c'"),
  },
  {
    name: 'Light Tunnel background uses a capped WebGL2 render loop with React Bits attribution',
    file: 'components/ui/light-tunnel.tsx',
    test: (source) =>
      source.includes("getContext('webgl2'") &&
      source.includes('1000 / 30') &&
      source.includes('David Haz') &&
      source.includes('loseContext'),
  },
  {
    name: 'Stroke wordmark draws outlined characters and wipes in its fill',
    file: 'components/ui/stroke-wordmark.tsx',
    test: (source) =>
      source.includes('silentra-stroke-char') &&
      source.includes('silentra-stroke-fill-wipe') &&
      source.includes('SILENTRA'),
  },
  {
    name: 'Shared Silentra loading uses the responsive scissors animation and reduced-motion support',
    file: 'components/ui/silentra-loading.tsx',
    test: (source) =>
      source.includes('sl-scissors') &&
      source.includes('sl-cut-a') &&
      source.includes('sl-compact') &&
      source.includes('prefers-reduced-motion: reduce') &&
      source.includes('SILENTRA') &&
      source.includes('FOR BARBERS') &&
      source.includes('aria-busy="true"'),
  },
  {
    name: 'Global route loading uses the shared Silentra scissors animation',
    file: 'app/loading.tsx',
    test: (source) =>
      source.includes(
        "import { SilentraLoading } from '@/components/ui/silentra-loading'",
      ) && source.includes('<SilentraLoading />'),
  },
  {
    name: 'Dashboard loading skeletons reuse the compact Silentra scissors animation',
    file: 'app/dashboard/_components/dashboard-skeleton.tsx',
    test: (source) =>
      source.includes(
        "import { SilentraLoading } from '@/components/ui/silentra-loading'",
      ) &&
      source.includes('<SilentraLoading variant="compact" />') &&
      source.includes('<HeaderSkeleton />'),
  },
  {
    name: 'Dashboard route loading uses the full-screen Silentra animation',
    file: 'app/dashboard/loading.tsx',
    test: (source) =>
      source.includes(
        "import { SilentraLoading } from '@/components/ui/silentra-loading'",
      ) && source.includes('<SilentraLoading variant="dashboard" />'),
  },
  {
    name: 'Onboarding route loading uses the shared Silentra scissors loader',
    file: 'app/api/onboarding/layout.tsx',
    test: (source) =>
      source.includes(
        "import { SilentraLoading } from '@/components/ui/silentra-loading'",
      ) &&
      source.includes('<SilentraLoading />') &&
      !source.includes('<Spinner'),
  },
  {
    name: 'POS loading screens use the shared Silentra scissors loader',
    file: 'app/dashboard/pos/overview/page.tsx',
    test: (source) =>
      source.includes(
        "import { SilentraLoading } from '@/components/ui/silentra-loading'",
      ) &&
      source.includes('<SilentraLoading variant="dashboard" />') &&
      !source.includes('<Spinner'),
  },
  {
    name: 'POS overview distinguishes initial loading, plan access and recoverable transaction errors',
    file: 'app/dashboard/pos/overview/page.tsx',
    test: (source) => {
      const normalized = source.replace(/\\s+/g, ' ');
      return (
        normalized.includes('const isInitialLoad = !hasLoadedTransactions') &&
        normalized.includes('!response.ok || !Array.isArray(body.transactions)') &&
        normalized.includes('setHasLoadedTransactions(true)') &&
        normalized.includes('if (accessLoading)') &&
        normalized.includes('if (!allowed)') &&
        normalized.includes('if (loading)') &&
        normalized.includes('loadError && !hasLoadedTransactions') &&
        normalized.includes('loadError && hasLoadedTransactions') &&
        normalized.includes('onClick={() => void load()}') &&
        normalized.includes("t('common.retry')")
      );
    },
  },
  {
    name: 'Barbershop deletion requires password and a one-time email code on the server',
    file: 'app/api/dashboard/barbershop-deletion/request-code/route.ts',
    test: (source) =>
      source.includes('supabase.auth.getUser()') &&
      source.includes('verifyAccountPassword(user.email, password)') &&
      source.includes('consumePublicRateLimit') &&
      source.includes('sendBarbershopDeletionCodeEmail') &&
      source.includes('expiresInSeconds: 600'),
  },
  {
    name: 'Barbershop deletion cancels Stripe and atomically removes tenant data without deleting user accounts',
    file: 'app/api/dashboard/barbershop-deletion/confirm/route.ts',
    test: (source) =>
      source.includes('verify_barbershop_deletion_code') &&
      source.includes('stripe.subscriptions.cancel') &&
      source.includes('delete_barbershop_after_verification') &&
      source.includes("storage.from('avatar').remove") &&
      source.includes("storage.from('banner').remove"),
  },
  {
    name: 'Barbershop deletion migration detaches user profiles and restricts verification RPCs to service role',
    file: 'supabase/migrations/20261103010515_secure_barbershop_deletion.sql',
    test: (source) =>
      source.includes('on delete set null') &&
      source.includes('barbershop_deletion_verifications') &&
      source.includes('delete from public.billing_documents') &&
      source.includes('delete from public.client_plan_payments') &&
      source.includes('delete from public.notification_queue') &&
      source.includes('delete from public.subscriptions') &&
      source.includes(
        'revoke all on function public.delete_barbershop_after_verification',
      ) &&
      source.includes('to service_role'),
  },
  {
    name: 'Invite join permits orphaned owner profiles but blocks owners already linked to a shop',
    file: 'supabase/migrations/20261116235500_allow_orphan_owner_team_join.sql',
    test: (source) =>
      source.includes("and u.role = 'owner'") &&
      source.includes('and u.barbershop_id is not null') &&
      source.includes('owner_already_has_barbershop') &&
      source.includes('grant execute on function public.join_barbershop_with_invite(text)'),
  },
  {
    name: 'Invite join blocks linked team members from switching tenants through direct RPC calls',
    file: 'supabase/migrations/20261117120000_rework_team_invites_with_links_and_qr.sql',
    test: (source) =>
      source.includes("raise exception 'already_team_member' using errcode = '22023'") &&
      source.includes('u.barbershop_id is not null') &&
      source.includes('The frontend redirect is not an authorization rule'),
  },
  {
    name: 'Invite join qualifies professional barbershop columns to avoid RETURNS TABLE ambiguity',
    file: 'supabase/migrations/20261117001500_qualify_invite_professional_barbershop_columns.sql',
    test: (source) =>
      source.includes('from public.professionals as professional') &&
      (source.split('professional.barbershop_id = v_invite.barbershop_id').length - 1) === 2 &&
      !source.includes('where barbershop_id = v_invite.barbershop_id'),
  },
  {
    name: 'Onboarding API explains when an owner account is already linked to another barbershop',
    file: 'app/api/onboarding/join-v2/route.ts',
    test: (source) =>
      source.includes("error.message === 'owner_already_has_barbershop'") &&
      source.includes("error.message === 'already_team_member'") &&
      source.includes('status: 409') &&
      source.includes('Esta conta já é proprietária de outra barbearia.') &&
      source.includes('Esta conta já está associada a uma barbearia.'),
  },
  {
    name: 'Public booking time-slot lookup distinguishes loading, empty and retryable errors',
    file: 'app/barbershops/components/booking-drawer-canonical.tsx',
    test: (source) => {
      const normalized = source.replace(/\s+/g, ' ');
      return (
        normalized.includes('loadingAvailability ? (') &&
        normalized.includes('role="status" aria-live="polite"') &&
        normalized.includes(') : slots.length ? (') &&
        normalized.includes('selectedDayClosed') &&
        normalized.includes("t('bookingDrawer.noSlots')") &&
        normalized.includes(".catch((reason) => {") &&
        normalized.includes("if (reason?.name !== 'AbortError')") &&
        normalized.includes('setError(') &&
        normalized.includes('setLoadingAvailability(false)') &&
        normalized.includes('role="alert"') &&
        normalized.includes('onClick={() => { setError(\'\'); if (step < 3) setRetryKey((value) => value + 1); }}') &&
        normalized.includes("t('bookingDrawer.retry')")
      );
    },
  },
  {
    name: 'Customer portal exposes recoverable load and reschedule states without confusing errors with empty results',
    file: 'components/customer-portal/my-bookings-page.tsx',
    test: (source) => {
      const normalized = source.replace(/\s+/g, ' ');
      return (
        normalized.includes('!sessionEmail && loadError ? (') &&
        normalized.includes('role="alert"') &&
        normalized.includes('Tenta novamente antes de introduzires os teus dados.') &&
        normalized.includes("onClick={() => void load({ showLoading: false })}") &&
        normalized.includes('upcoming.length === 0') &&
        normalized.includes('Não tens próximas marcações') &&
        normalized.includes('availabilityLoading ? (') &&
        normalized.includes('availabilityError ? (') &&
        normalized.includes('role="alert"') &&
        normalized.includes('onClick={() => void getAvailability(reschedule, date)}') &&
        normalized.includes('availability?.closedDay') &&
        normalized.includes('availability.availableSlots.length > 0') &&
        normalized.includes('Não há horários disponíveis nesta data. Escolhe outro dia.') &&
        normalized.includes('toast.success(\'Marcação reagendada. O novo horário já está atualizado.\')') &&
        normalized.includes('toast.success(\'Marcação cancelada. O estado já foi atualizado.\')')
      );
    },
  },
  {
    name: 'QR-code page distinguishes loading from a recoverable configuration error',
    file: 'app/dashboard/qr-code/page.tsx',
    test: (source) => {
      const normalized = source.replace(/\s+/g, ' ');
      return (
        normalized.includes('const loadConfig = useCallback(async () =>') &&
        normalized.includes('setLoadError(null)') &&
        normalized.includes('typeof payload.slug !== \'string\'') &&
        normalized.includes('typeof payload.canCustomize !== \'boolean\'') &&
        normalized.includes('setLoadError(') &&
        normalized.includes(') : loadError ? (') &&
        normalized.includes('role=\"alert\"') &&
        normalized.includes('onClick={() => void loadConfig()}') &&
        normalized.includes("t('common.retry')") &&
        normalized.includes('aria-busy=\"true\"')
      );
    },
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
