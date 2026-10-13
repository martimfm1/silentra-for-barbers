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
      source.includes('sendBrevoEmail'),
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
      source.includes("relation?.is_public_in_directory === true") &&
      source.includes("relation?.marketplace_sales_mode === 'physical_and_online'") &&
      source.includes('Produto não encontrado ou indisponível.'),
  },
  {
    name: 'Marketplace has dedicated product pages and add-to-cart handoff',
    file: 'app/marketplace/[productId]/page.tsx',
    test: (source) =>
      source.includes('/api/marketplace/products?id=') &&
      source.includes("searchParams.set('add', product.id)") &&
      source.includes("searchParams.set(") &&
      source.includes('Adicionar ao carrinho'),
  },
  {
    name: 'Marketplace catalog cards link to product detail pages and persist cart',
    file: 'app/marketplace/page.tsx',
    test: (source) =>
      source.includes('href={`/marketplace/${product.id}`}') &&
      source.includes('silentra-marketplace-cart') &&
      source.includes("url.searchParams.get('add')"),
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
