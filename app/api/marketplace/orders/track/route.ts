import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';

export const runtime = 'nodejs';

async function POST__unobserved(request: Request) {
  const allowed = await consumePublicRateLimit(
    request,
    'marketplace-order-track',
    'token-lookup',
    20,
    300,
  );
  if (!allowed)
    return NextResponse.json(
      {
        error:
          'Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.',
      },
      { status: 429, headers: { 'Retry-After': '300' } },
    );
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!/^[a-f0-9]{64}$/.test(token))
    return NextResponse.json(
      { error: 'Link de acompanhamento inválido.' },
      { status: 400 },
    );
  try {
    const hash = createHash('sha256').update(token).digest('hex');
    const db = createAdminClient();
    const { data: order, error } = await db
      .from('marketplace_orders')
      .select(
        'id, status, total, created_at, fulfillment_method, barbershops(name), marketplace_order_items(product_name, quantity, total)',
      )
      .eq('tracking_token_hash', hash)
      .maybeSingle();
    if (error) {
      console.error('[MARKETPLACE_ORDER_TRACK_LOOKUP_FAILED]', {
        code: error.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível consultar a encomenda.' },
        { status: 503 },
      );
    }
    if (!order)
      return NextResponse.json(
        { error: 'Link inválido ou encomenda não encontrada.' },
        { status: 404 },
      );
    const shop = Array.isArray(order.barbershops)
      ? order.barbershops[0]
      : order.barbershops;
    return NextResponse.json(
      {
        order: {
          reference: order.id.slice(0, 8),
          status: order.status,
          total: order.total,
          createdAt: order.created_at,
          fulfillmentMethod: order.fulfillment_method,
          shopName: typeof shop?.name === 'string' ? shop.name : 'Barbearia',
          items: (order.marketplace_order_items ?? []).map(
            (item: {
              product_name: string;
              quantity: number;
              total: number;
            }) => ({
              name: item.product_name,
              quantity: item.quantity,
              total: item.total,
            }),
          ),
        },
      },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch {
    console.error('[MARKETPLACE_ORDER_TRACK_UNEXPECTED_FAILURE]');
    return NextResponse.json(
      { error: 'Não foi possível consultar a encomenda.' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/marketplace/orders/track',
  POST__unobserved,
);
