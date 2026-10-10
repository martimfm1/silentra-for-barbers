import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';
const METHODS = ['cash', 'card', 'transfer', 'other'] as const;

type ItemInput = {
  productId?: unknown;
  serviceId?: unknown;
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
};

async function GET__unobserved() {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { data, error } = await admin
      .from('pos_transactions')
      .select('*,pos_transaction_items(*)')
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ transactions: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to load POS transactions' },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: Request) {
  try {
    const { admin, barbershopId, userId } = await requireModuleContext(
      'pos',
      'pos',
    );
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const paymentMethod =
      typeof body?.paymentMethod === 'string' ? body.paymentMethod : '';
    const items = Array.isArray(body?.items)
      ? (body.items.slice(0, 100) as ItemInput[])
      : [];

    if (
      !METHODS.includes(paymentMethod as (typeof METHODS)[number]) ||
      items.length === 0
    ) {
      return NextResponse.json(
        { error: 'Payment method and at least one item are required' },
        { status: 400 },
      );
    }

    const normalized = items.map((item) => ({
      productId: typeof item.productId === 'string' ? item.productId : null,
      serviceId: typeof item.serviceId === 'string' ? item.serviceId : null,
      description:
        typeof item.description === 'string'
          ? item.description.trim().slice(0, 200)
          : '',
      quantity: typeof item.quantity === 'number' ? item.quantity : NaN,
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : NaN,
    }));

    if (
      normalized.some(
        (item) =>
          !item.description ||
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0 ||
          Boolean(item.productId) === Boolean(item.serviceId),
      )
    ) {
      return NextResponse.json({ error: 'Invalid POS item' }, { status: 400 });
    }

    const requestedDiscount =
      typeof body?.discount === 'number' && Number.isFinite(body.discount)
        ? Math.max(0, body.discount)
        : 0;

    const { data: transaction, error } = await admin.rpc(
      'create_pos_transaction_atomic',
      {
        p_barbershop_id: barbershopId,
        p_location_id:
          typeof body?.locationId === 'string' ? body.locationId : null,
        p_client_id: typeof body?.clientId === 'string' ? body.clientId : null,
        p_appointment_id:
          typeof body?.appointmentId === 'string' ? body.appointmentId : null,
        p_payment_method: paymentMethod,
        p_discount: requestedDiscount,
        p_created_by: userId,
        p_items: normalized,
      },
    );

    if (error || !transaction) {
      const message = error?.message ?? 'Unable to create POS transaction';
      if (/insufficient stock/i.test(message)) {
        return NextResponse.json(
          { error: message, code: 'INSUFFICIENT_STOCK' },
          { status: 409 },
        );
      }
      if (/price changed/i.test(message)) {
        return NextResponse.json(
          { error: message, code: 'PRICE_CHANGED' },
          { status: 409 },
        );
      }
      if (/does not belong/i.test(message)) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      throw error ?? new Error(message);
    }

    const { data: createdItems, error: itemsError } = await admin
      .from('pos_transaction_items')
      .select('*')
      .eq('transaction_id', transaction.id);

    if (itemsError) throw itemsError;

    return NextResponse.json(
      { transaction: { ...transaction, items: createdItems ?? [] } },
      { status: 201 },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Unable to create POS transaction' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/enterprise/pos', GET__unobserved);
export const POST = withApiObservability(
  '/api/enterprise/pos',
  POST__unobserved,
);
