import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';

export const runtime = 'nodejs';

const MAX_QUERY_LENGTH = 80;
const CATALOG_RATE_LIMIT = 120;
const CATALOG_RATE_WINDOW_SECONDS = 60;
// All response fields are public catalogue data; only cache successful responses.
const PUBLIC_CATALOG_CACHE =
  'public, max-age=0, s-maxage=15, stale-while-revalidate=45';
const MAX_CATEGORY_LENGTH = 80;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SORT_MODES = ['featured', 'price_asc', 'price_desc', 'newest'] as const;
type SortMode = (typeof SORT_MODES)[number];

function normalizeSearchQuery(value: string): string {
  // Keep user input out of the PostgREST filter grammar. Only letters,
  // numbers, spaces, apostrophes and hyphens can reach the text filter.
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function GET__unobserved(request: Request) {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get('q')?.trim() ?? '';
  const rawCategory = url.searchParams.get('category')?.trim() ?? '';
  const rawSort = url.searchParams.get('sort') ?? 'featured';
  const shopId = url.searchParams.get('shop')?.trim() ?? '';
  const productId = url.searchParams.get('id')?.trim() ?? '';

  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: 'A pesquisa excede o limite permitido.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (rawCategory.length > MAX_CATEGORY_LENGTH) {
    return NextResponse.json(
      { error: 'A categoria selecionada não é válida.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!SORT_MODES.includes(rawSort as SortMode)) {
    return NextResponse.json(
      { error: 'A ordenação selecionada não é válida.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (productId && !UUID_PATTERN.test(productId)) {
    return NextResponse.json(
      { error: 'O produto selecionado não é válido.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (shopId && !UUID_PATTERN.test(shopId)) {
    return NextResponse.json(
      { error: 'A barbearia selecionada não é válida.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const q = normalizeSearchQuery(rawQuery);
  if (rawQuery && !q) {
    return NextResponse.json(
      { error: 'A pesquisa não contém caracteres válidos.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let allowed: boolean;
  try {
    allowed = await consumePublicRateLimit(
      request,
      'marketplace-products',
      'catalog',
      CATALOG_RATE_LIMIT,
      CATALOG_RATE_WINDOW_SECONDS,
    );
  } catch {
    console.error('[MARKETPLACE_PRODUCTS_RATE_LIMIT]', 'unavailable');
    return NextResponse.json(
      { error: 'O marketplace está temporariamente indisponível.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiadas pesquisas. Tenta novamente dentro de um minuto.' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(CATALOG_RATE_WINDOW_SECONDS),
        },
      },
    );
  }

  const category = rawCategory || '';
  const sort = rawSort as SortMode;
  const db = createAdminClient();
  let query = db
    .from('inventory_products')
    .select(
      'id,barbershop_id,name,description,category,image_url,unit_price,compare_at_price,stock_quantity,marketplace_featured,marketplace_published_at,marketplace_featured_until,created_at,updated_at,barbershops!inner(name,slug,is_public_in_directory,marketplace_sales_mode)',
    )
    .eq('active', true)
    .eq('marketplace_visible', true)
    // Keep tenant visibility restrictions inside the database query, before
    // service-role results are materialized in the application.
    .eq('barbershops.is_public_in_directory', true)
    .eq('barbershops.marketplace_sales_mode', 'physical_and_online')
    .limit(100);

  if (productId) query = query.eq('id', productId);
  else query = query.gt('stock_quantity', 0);

  if (q && !productId) {
    // normalizeSearchQuery removes PostgREST grammar delimiters and
    // wildcard characters before this OR filter is assembled.
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (category && !productId) query = query.eq('category', category);
  if (shopId && !productId) query = query.eq('barbershop_id', shopId);

  if (sort === 'price_asc')
    query = query.order('unit_price', { ascending: true });
  else if (sort === 'price_desc')
    query = query.order('unit_price', { ascending: false });
  else if (sort === 'newest')
    query = query.order('updated_at', { ascending: false });
  else query = query.order('updated_at', { ascending: false });

  // Start the featured-products lookup before awaiting the base catalogue query.
  // These reads are independent, so featured sorting costs one database round trip
  // instead of two sequential round trips.
  const featuredProductsPromise =
    sort === 'featured' && !productId
      ? (async () => {
          let featuredQuery = db
            .from('inventory_products')
            .select(
              'id,barbershop_id,name,description,category,image_url,unit_price,compare_at_price,stock_quantity,marketplace_featured,marketplace_published_at,marketplace_featured_until,created_at,updated_at,barbershops!inner(name,slug,is_public_in_directory,marketplace_sales_mode)',
            )
            .eq('active', true)
            .eq('marketplace_visible', true)
            .eq('marketplace_featured', true)
            .gt('marketplace_featured_until', new Date().toISOString())
            .gt('stock_quantity', 0)
            .eq('barbershops.is_public_in_directory', true)
            .eq('barbershops.marketplace_sales_mode', 'physical_and_online');

          if (q)
            featuredQuery = featuredQuery.or(
              `name.ilike.%${q}%,description.ilike.%${q}%`,
            );
          if (category) featuredQuery = featuredQuery.eq('category', category);
          if (shopId) featuredQuery = featuredQuery.eq('barbershop_id', shopId);

          return await featuredQuery
            .order('marketplace_featured_until', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(100);
        })()
      : null;

  const { data, error } = await query;
  if (error) {
    console.error('[MARKETPLACE_PRODUCTS_API]', error.name ?? 'database_error');
    return NextResponse.json(
      { error: 'Não foi possível carregar o marketplace.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Defense in depth: retain the public visibility check before constructing
  // the response even though the same restrictions apply in the SQL query.
  const now = Date.now();
  const visible = (data ?? [])
    .filter((item) => {
      const relation = Array.isArray(item.barbershops)
        ? item.barbershops[0]
        : item.barbershops;
      return (
        relation?.is_public_in_directory === true &&
        relation?.marketplace_sales_mode === 'physical_and_online'
      );
    })
    .map((item) => ({
      ...item,
      marketplace_featured:
        item.marketplace_featured === true &&
        typeof item.marketplace_featured_until === 'string' &&
        Date.parse(item.marketplace_featured_until) > now,
    }));

  if (productId) {
    const product = visible[0];
    if (!product) {
      return NextResponse.json(
        { error: 'Produto não encontrado ou indisponível.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { product },
      { headers: { 'Cache-Control': PUBLIC_CATALOG_CACHE } },
    );
  }

  let catalog = visible;

  if (sort === 'featured') {
    // The promise started alongside the base query above to avoid serial latency.
    const { data: featuredData, error: featuredError } =
      await featuredProductsPromise!;

    if (featuredError) {
      console.error(
        '[MARKETPLACE_FEATURED_PRODUCTS_API]',
        featuredError.name ?? 'database_error',
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar os produtos em destaque.' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const activeFeatured = (featuredData ?? [])
      .filter((item) => {
        const relation = Array.isArray(item.barbershops)
          ? item.barbershops[0]
          : item.barbershops;
        return (
          relation?.is_public_in_directory === true &&
          relation?.marketplace_sales_mode === 'physical_and_online'
        );
      })
      .map((item) => ({ ...item, marketplace_featured: true }));
    const featuredIds = new Set(activeFeatured.map((item) => item.id));
    catalog = [
      ...activeFeatured,
      ...visible.filter((item) => !featuredIds.has(item.id)),
    ].slice(0, 100);
  }

  const categories = [
    ...new Set(catalog.map((item) => item.category).filter(Boolean)),
  ].sort();
  const shops = [
    ...new Map(
      catalog
        .map((item) => {
          const relation = Array.isArray(item.barbershops)
            ? item.barbershops[0]
            : item.barbershops;
          return relation
            ? ([
                item.barbershop_id,
                {
                  id: item.barbershop_id,
                  name: relation.name,
                  slug: relation.slug,
                },
              ] as const)
            : null;
        })
        .filter(
          (
            item,
          ): item is readonly [
            string,
            { id: string; name: string; slug: string | null },
          ] => Boolean(item),
        ),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));

  return NextResponse.json(
    { products: catalog, categories, shops },
    { headers: { 'Cache-Control': PUBLIC_CATALOG_CACHE } },
  );
}

export const GET = withApiObservability(
  '/api/marketplace/products',
  GET__unobserved,
);
