import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/security/request-validation';
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
    const bodyResult = await readJsonObject(request, {
      maxBytes: 8 * 1024,
      allowedKeys: [
        'locationId',
        'name',
        'sku',
        'unitPrice',
        'stockQuantity',
        'lowStockThreshold',
      ],
    });
    if (!bodyResult.ok) return bodyResult.response;
    const body = bodyResult.value;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 160)
      return NextResponse.json(
        { error: 'Invalid product name' },
        { status: 400 },
      );
    if (
      (body.locationId !== undefined &&
        body.locationId !== null &&
        (typeof body.locationId !== 'string' || body.locationId.length > 80)) ||
      (body.sku !== undefined &&
        body.sku !== null &&
        (typeof body.sku !== 'string' || body.sku.length > 80))
    )
      return NextResponse.json(
        { error: 'Invalid inventory product fields' },
        { status: 400 },
      );
    const numeric = (value: unknown, fallback = 0) =>
      value === undefined
        ? fallback
        : typeof value === 'number' &&
            Number.isFinite(value) &&
            value >= 0 &&
            value <= 1_000_000_000
          ? value
          : NaN;
    const unitPrice = numeric(body.unitPrice);
    const stockQuantity = numeric(body.stockQuantity);
    const lowStockThreshold = numeric(body.lowStockThreshold);
    if (
      !Number.isFinite(unitPrice) ||
      !Number.isFinite(stockQuantity) ||
      !Number.isFinite(lowStockThreshold)
    )
      return NextResponse.json(
        { error: 'Invalid inventory quantities or price' },
        { status: 400 },
      );
    const locationId =
      typeof body.locationId === 'string' ? body.locationId : null;
    if (locationId) {
      const { data: location, error: locationError } = await admin
        .from('locations')
        .select('id')
        .eq('id', locationId)
        .eq('parent_barbershop_id', barbershopId)
        .maybeSingle();
      if (locationError) throw locationError;
      if (!location)
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 },
        );
    }
    const { data, error } = await admin
      .from('inventory_products')
      .insert({
        barbershop_id: barbershopId,
        location_id: locationId,
        name,
        sku: typeof body.sku === 'string' ? body.sku.trim() || null : null,
        unit_price: unitPrice,
        stock_quantity: stockQuantity,
        low_stock_threshold: lowStockThreshold,
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

export const GET = withApiObservability(
  '/api/enterprise/inventory',
  GET__unobserved,
);
export const POST = withApiObservability(
  '/api/enterprise/inventory',
  POST__unobserved,
);
