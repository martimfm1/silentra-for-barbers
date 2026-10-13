import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';

export const runtime = 'nodejs';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const MAX_BODY_BYTES = 512;

async function readSmallJsonBody(
  request: Request,
): Promise<
  | { kind: 'ok'; value: unknown }
  | { kind: 'invalid' }
  | { kind: 'too-large' }
> {
  const reader = request.body?.getReader();
  if (!reader) return { kind: 'invalid' };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { kind: 'too-large' };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    try {
      return { kind: 'ok', value: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return { kind: 'invalid' };
    }
  } catch {
    return { kind: 'invalid' };
  } finally {
    reader.releaseLock();
  }
}

async function POST__unobserved(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Pedido inválido.' },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const allowed = await consumePublicRateLimit(
      request,
      'marketplace-order-track',
      'token-lookup',
      20,
      300,
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            'Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.',
        },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '300',
          },
        },
      );
    }

    const parsedBody = await readSmallJsonBody(request);
    if (parsedBody.kind === 'too-large') {
      return NextResponse.json(
        { error: 'Pedido demasiado grande.' },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (parsedBody.kind !== 'ok') {
      return NextResponse.json(
        { error: 'Pedido inválido.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const body = parsedBody.value as { token?: unknown } | null;
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json(
        { error: 'Link de acompanhamento inválido.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const db = createAdminClient();
    const { data: order, error } = await db
      .from('marketplace_orders')
      .select(
        'id, status, total, created_at, fulfillment_method, barbershops(name), marketplace_order_items(product_name, quantity, total)',
      )
      .eq('tracking_token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      console.error('[MARKETPLACE_ORDER_TRACK_LOOKUP_FAILED]', {
        code: error.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível consultar a encomenda.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!order) {
      return NextResponse.json(
        { error: 'Link inválido ou encomenda não encontrada.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

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
      {
        headers: {
          'Cache-Control': 'no-store, private',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      },
    );
  } catch {
    console.error('[MARKETPLACE_ORDER_TRACK_UNEXPECTED_FAILURE]');
    return NextResponse.json(
      { error: 'Não foi possível consultar a encomenda.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const POST = withApiObservability(
  '/api/marketplace/orders/track',
  POST__unobserved,
);
