import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

const normalize = (body: Record<string, unknown> | null) => ({
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

async function PATCHHandler(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { productId } = await params;
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const product = normalize(body);
    if (
      !product.name ||
      !Number.isFinite(product.unit_price) ||
      product.unit_price < 0 ||
      !Number.isFinite(product.stock_quantity) ||
      product.stock_quantity < 0 ||
      !Number.isFinite(product.low_stock_threshold) ||
      product.low_stock_threshold < 0 ||
      (product.compare_at_price != null &&
        (!Number.isFinite(product.compare_at_price) ||
          product.compare_at_price < product.unit_price))
    ) {
      return NextResponse.json(
        { error: 'Verifica os dados do produto.' },
        { status: 400 },
      );
    }
    const { data, error } = await admin
      .from('inventory_products')
      .update({ ...product, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('barbershop_id', barbershopId)
      .select('*')
      .maybeSingle();
    if (error || !data)
      return NextResponse.json(
        { error: 'Produto não encontrado.' },
        { status: 404 },
      );
    return NextResponse.json({ product: data });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível atualizar o produto.' },
      { status: 500 },
    );
  }
}

async function DELETEHandler(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { productId } = await params;
    const { error } = await admin
      .from('inventory_products')
      .update({
        active: false,
        marketplace_visible: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('barbershop_id', barbershopId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível arquivar o produto.' },
      { status: 500 },
    );
  }
}

export const PATCH = withApiLogging(
  '/api/marketplace/manage/products/[productId]',
  PATCHHandler,
);
export const DELETE = withApiLogging(
  '/api/marketplace/manage/products/[productId]',
  DELETEHandler,
);
