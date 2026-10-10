import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

const parsePayload = (body: Record<string, unknown> | null) => ({
  name: typeof body?.name === 'string' ? body.name.trim() : '',
  description:
    typeof body?.description === 'string' ? body.description.trim() : null,
  category: typeof body?.category === 'string' ? body.category.trim() : null,
  image_url: typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : null,
  sku: typeof body?.sku === 'string' ? body.sku.trim() : null,
  unit_price: Number(body?.unitPrice),
  stock_quantity: Number(body?.stockQuantity),
  low_stock_threshold: Number(body?.lowStockThreshold ?? 0),
  compare_at_price:
    body?.compareAtPrice === '' || body?.compareAtPrice == null
      ? null
      : Number(body.compareAtPrice),
  active: body?.active !== false,
  marketplace_visible: body?.marketplaceVisible === true,
  marketplace_featured: body?.marketplaceFeatured === true,
});

function validate(product: ReturnType<typeof parsePayload>) {
  return (
    product.name.length >= 1 &&
    product.name.length <= 160 &&
    Number.isFinite(product.unit_price) &&
    product.unit_price >= 0 &&
    Number.isFinite(product.stock_quantity) &&
    product.stock_quantity >= 0 &&
    Number.isFinite(product.low_stock_threshold) &&
    product.low_stock_threshold >= 0 &&
    (product.compare_at_price == null ||
      (Number.isFinite(product.compare_at_price) &&
        product.compare_at_price >= product.unit_price))
  );
}

async function GET__unobserved() {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { data, error } = await admin
      .from('inventory_products')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível carregar os produtos.' },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const product = parsePayload(body);
    if (!validate(product))
      return NextResponse.json(
        { error: 'Verifica os dados do produto.' },
        { status: 400 },
      );
    const { data, error } = await admin
      .from('inventory_products')
      .insert({ ...product, barbershop_id: barbershopId })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível criar o produto.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/marketplace/manage/products',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/marketplace/manage/products',
  POST__unobserved,
);
