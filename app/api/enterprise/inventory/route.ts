import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

async function GET__unobserved() {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'inventory',
      'inventory',
    );
    const { data, error } = await admin
      .from('inventory_products')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('name');
    if (error) throw error;
    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load inventory' },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'inventory',
      'inventory',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 160)
      return NextResponse.json(
        { error: 'Invalid product name' },
        { status: 400 },
      );
    const numeric = (value: unknown, fallback = 0) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : fallback;
    const { data, error } = await admin
      .from('inventory_products')
      .insert({
        barbershop_id: barbershopId,
        location_id:
          typeof body?.locationId === 'string' ? body.locationId : null,
        name,
        sku: typeof body?.sku === 'string' ? body.sku.slice(0, 80) : null,
        unit_price: numeric(body?.unitPrice),
        stock_quantity: numeric(body?.stockQuantity),
        low_stock_threshold: numeric(body?.lowStockThreshold),
      })
      .select('*')
      .single();
    if (error)
      return NextResponse.json(
        { error: 'Unable to create product' },
        { status: 500 },
      );
    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to create inventory product' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/enterprise/inventory', GET__unobserved);
export const POST = withApiObservability('/api/enterprise/inventory', POST__unobserved);
