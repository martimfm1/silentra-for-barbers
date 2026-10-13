import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

const BOOST_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const normalize = (body: Record<string, unknown> | null) => ({
  name: typeof body?.name === 'string' ? body.name.trim() : '',
  description:
    typeof body?.description === 'string' ? body.description.trim() : null,
  category: typeof body?.category === 'string' ? body.category.trim() : null,
  image_url:
    typeof body?.imageUrl === 'string' && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : null,
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

function validate(product: ReturnType<typeof normalize>) {
  const validImageUrl =
    product.image_url == null ||
    (product.image_url.length <= 2048 &&
      (() => {
        try {
          const url = new URL(product.image_url);
          return url.protocol === 'https:' || url.protocol === 'http:';
        } catch {
          return false;
        }
      })());

  return (
    product.name.length >= 1 &&
    product.name.length <= 160 &&
    (product.description == null || product.description.length <= 5000) &&
    (product.category == null || product.category.length <= 80) &&
    (product.sku == null || product.sku.length <= 80) &&
    validImageUrl &&
    Number.isFinite(product.unit_price) &&
    product.unit_price >= 0 &&
    Number.isFinite(product.stock_quantity) &&
    product.stock_quantity >= 0 &&
    Number.isInteger(product.stock_quantity) &&
    Number.isFinite(product.low_stock_threshold) &&
    product.low_stock_threshold >= 0 &&
    Number.isInteger(product.low_stock_threshold) &&
    (product.compare_at_price == null ||
      (Number.isFinite(product.compare_at_price) &&
        product.compare_at_price >= product.unit_price))
  );
}

function currentlyFeatured<T extends {
  marketplace_featured?: boolean | null;
  marketplace_featured_until?: string | null;
}>(product: T) {
  return (
    product.marketplace_featured === true &&
    typeof product.marketplace_featured_until === 'string' &&
    Date.parse(product.marketplace_featured_until) > Date.now()
  );
}

async function PATCH__unobserved(
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

    if (!validate(product)) {
      return NextResponse.json(
        { error: 'Verifica os dados do produto.' },
        { status: 400 },
      );
    }
    if (product.marketplace_featured && !product.marketplace_visible) {
      return NextResponse.json(
        { error: 'Publica o produto antes de ativar o destaque.' },
        { status: 400 },
      );
    }
    if (
      product.marketplace_featured &&
      (!product.active || product.stock_quantity <= 0)
    ) {
      return NextResponse.json(
        { error: 'O destaque requer um produto ativo com stock disponível.' },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await admin
      .from('inventory_products')
      .select('id, marketplace_published_at, marketplace_visible, marketplace_featured_until')
      .eq('id', productId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json(
        { error: 'Produto não encontrado.' },
        { status: 404 },
      );
    }

    const now = new Date();
    const publishedAt =
      existing.marketplace_published_at ??
      (product.marketplace_visible ? now.toISOString() : null);
    let featuredUntil: string | null = null;

    if (product.marketplace_featured) {
      const { data: planData, error: planError } = await admin.rpc(
        'get_effective_billing_plan_for_barbershop',
        { p_barbershop_id: barbershopId },
      );
      if (planError) {
        console.error('[MARKETPLACE_MANAGE_PLAN_LOOKUP_FAILED]', {
          code: planError.code ?? 'UNKNOWN',
        });
        return NextResponse.json(
          { error: 'Não foi possível verificar o plano da barbearia.' },
          { status: 503 },
        );
      }
      const plan = typeof planData === 'string' ? planData : 'free';
      if (plan !== 'enterprise') {
        return NextResponse.json(
          { error: 'O destaque de 3 dias está disponível apenas no plano Enterprise.' },
          { status: 403 },
        );
      }
      if (!publishedAt) {
        return NextResponse.json(
          { error: 'Publica o produto antes de ativar o destaque.' },
          { status: 400 },
        );
      }
      const deadline = Date.parse(publishedAt) + BOOST_WINDOW_MS;
      if (now.getTime() >= deadline) {
        return NextResponse.json(
          { error: 'O destaque só pode ser ativado nos primeiros 3 dias após a publicação.' },
          { status: 400 },
        );
      }
      featuredUntil = new Date(deadline).toISOString();
    }

    const { data, error } = await admin
      .from('inventory_products')
      .update({
        ...product,
        marketplace_published_at: publishedAt,
        marketplace_featured_until: featuredUntil,
        updated_at: now.toISOString(),
      })
      .eq('id', productId)
      .eq('barbershop_id', barbershopId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Produto não encontrado.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { product: { ...data, marketplace_featured: currentlyFeatured(data) } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETPLACE_MANAGE_PRODUCT_UPDATE_FAILED]', {
      reason: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Não foi possível atualizar o produto.' },
      { status: 500 },
    );
  }
}

async function DELETE__unobserved(
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
        marketplace_featured: false,
        marketplace_featured_until: null,
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

export const PATCH = withApiObservability(
  '/api/marketplace/manage/products/[productId]',
  PATCH__unobserved,
);
export const DELETE = withApiObservability(
  '/api/marketplace/manage/products/[productId]',
  DELETE__unobserved,
);
