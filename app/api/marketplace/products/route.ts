import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

async function GETHandler(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const category = url.searchParams.get('category')?.trim() ?? '';
  const sort = url.searchParams.get('sort') ?? 'featured';
  const shopId = url.searchParams.get('shop')?.trim() ?? '';

  const db = createAdminClient();
  let query = db
    .from('inventory_products')
    .select(
      'id,barbershop_id,name,description,category,image_url,unit_price,compare_at_price,stock_quantity,marketplace_featured,barbershops(name,slug,is_public_in_directory,marketplace_sales_mode)',
    )
    .eq('active', true)
    .eq('marketplace_visible', true)
    .gt('stock_quantity', 0)
    .limit(100);

  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (category) query = query.eq('category', category);
  if (shopId) query = query.eq('barbershop_id', shopId);

  if (sort === 'price_asc')
    query = query.order('unit_price', { ascending: true });
  else if (sort === 'price_desc')
    query = query.order('unit_price', { ascending: false });
  else if (sort === 'newest')
    query = query.order('updated_at', { ascending: false });
  else
    query = query
      .order('marketplace_featured', { ascending: false })
      .order('updated_at', { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error('[MARKETPLACE_PRODUCTS_API]', error);
    return NextResponse.json(
      { error: 'Não foi possível carregar o marketplace.' },
      { status: 500 },
    );
  }

  const visible = (data ?? []).filter((item) => {
    const relation = Array.isArray(item.barbershops)
      ? item.barbershops[0]
      : item.barbershops;
    return (
      relation?.is_public_in_directory !== false &&
      relation?.marketplace_sales_mode === 'physical_and_online'
    );
  });

  const categories = [
    ...new Set(visible.map((item) => item.category).filter(Boolean)),
  ].sort();
  const shops = [
    ...new Map(
      visible
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

  return NextResponse.json({ products: visible, categories, shops });
}


export const GET = withApiLogging('/api/marketplace/products', GETHandler);
