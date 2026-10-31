import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import {
  hashMarketplaceTrackingToken,
  isMarketplaceTrackingToken,
} from '@/lib/marketplace/tracking';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 512;
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

type ParsedBody =
  { kind: 'ok'; value: unknown } | { kind: 'invalid' } | { kind: 'too-large' };

async function readSmallJsonBody(request: Request): Promise<ParsedBody> {
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

function notFound() {
  // Invalid, unknown and revoked tokens share one response to avoid disclosing
  // whether a particular order exists.
  return NextResponse.json(
    { error: 'Link inválido ou encomenda não encontrada.' },
    { status: 404, headers: PRIVATE_HEADERS },
  );
}

async function POST__unobserved(request: Request) {
  try {
    const contentType = request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase();
    if (contentType !== 'application/json') {
      return NextResponse.json(
        { error: 'O pedido tem de usar JSON.' },
        { status: 415, headers: PRIVATE_HEADERS },
      );
    }

    const contentLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Pedido inválido.' },
        { status: 413, headers: PRIVATE_HEADERS },
      );
    }

    // Aggregate IP bucket protects the endpoint from floods, including invalid
    // tokens. A second per-token bucket below avoids a shared-IP bottleneck for
    // several customers behind the same NAT.
    const ipAllowed = await consumePublicRateLimit(
      request,
      'marketplace-order-track',
      'ip-aggregate',
      120,
      300,
    );
    if (!ipAllowed) {
      return NextResponse.json(
        {
          error:
            'Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.',
        },
        {
          status: 429,
          headers: { ...PRIVATE_HEADERS, 'Retry-After': '300' },
        },
      );
    }

    const parsedBody = await readSmallJsonBody(request);
    if (parsedBody.kind === 'too-large') {
      return NextResponse.json(
        { error: 'Pedido demasiado grande.' },
        { status: 413, headers: PRIVATE_HEADERS },
      );
    }
    if (parsedBody.kind !== 'ok') {
      return NextResponse.json(
        { error: 'Pedido inválido.' },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    const body = parsedBody.value;
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, 'token')
    ) {
      return notFound();
    }
    const token =
      typeof (body as Record<string, unknown>).token === 'string'
        ? ((body as Record<string, unknown>).token as string)
        : '';
    if (!isMarketplaceTrackingToken(token)) {
      return notFound();
    }

    const tokenHash = hashMarketplaceTrackingToken(token);
    const tokenAllowed = await consumePublicRateLimit(
      request,
      'marketplace-order-track',
      `token:${tokenHash}`,
      20,
      300,
    );
    if (!tokenAllowed) {
      return NextResponse.json(
        {
          error: 'Demasiadas consultas para este link. Aguarda alguns minutos.',
        },
        {
          status: 429,
          headers: { ...PRIVATE_HEADERS, 'Retry-After': '300' },
        },
      );
    }

    const db = createAdminClient();
    let orderId: string | null = null;

    // New capabilities allow multiple private links per order, so status emails
    // do not invalidate the original receipt link.
    const { data: capability, error: capabilityError } = await db
      .from('marketplace_order_tracking_tokens')
      .select('id, order_id, revoked_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (capabilityError) {
      // Permit a compatibility fallback only while the table is genuinely
      // absent during a rolling deployment. Never bypass expiry/revocation on
      // permission, connectivity or other database failures.
      const missingCapabilityTable =
        capabilityError.code === '42P01' || capabilityError.code === 'PGRST205';
      console.error('[MARKETPLACE_TRACKING_CAPABILITY_LOOKUP_FAILED]', {
        code: capabilityError.code ?? 'UNKNOWN',
        compatibilityFallback: missingCapabilityTable,
      });
      if (!missingCapabilityTable) {
        return NextResponse.json(
          { error: 'Não foi possível consultar a encomenda neste momento.' },
          { status: 503, headers: PRIVATE_HEADERS },
        );
      }
    } else if (capability) {
      if (
        capability.revoked_at ||
        !capability.expires_at ||
        Date.parse(capability.expires_at) <= Date.now()
      ) {
        return notFound();
      }

      orderId = capability.order_id;
    }

    if (!orderId) {
      const { data: legacyOrder, error: legacyError } = await db
        .from('marketplace_orders')
        .select('id')
        .eq('tracking_token_hash', tokenHash)
        .maybeSingle();

      if (legacyError) {
        console.error('[MARKETPLACE_TRACKING_LEGACY_LOOKUP_FAILED]', {
          code: legacyError.code ?? 'UNKNOWN',
        });
        return NextResponse.json(
          { error: 'Não foi possível consultar a encomenda neste momento.' },
          { status: 503, headers: PRIVATE_HEADERS },
        );
      }
      if (!legacyOrder) return notFound();
      orderId = legacyOrder.id;

      // A legacy token can be created during a rolling deployment. Register it
      // with the new expiry/revocation model on first successful use when the
      // capability table is available. A concurrent insert is harmless.
      if (!capabilityError) {
        const { error: registerError } = await db
          .from('marketplace_order_tracking_tokens')
          .insert({ order_id: orderId, token_hash: tokenHash });
        if (registerError && registerError.code !== '23505') {
          console.error(
            '[MARKETPLACE_TRACKING_LEGACY_CAPABILITY_REGISTER_FAILED]',
            {
              code: registerError.code ?? 'UNKNOWN',
            },
          );
        }
      }
    }

    const { data: order, error: orderError } = await db
      .from('marketplace_orders')
      .select(
        'id, status, total, created_at, updated_at, fulfillment_method, shipping_address, shipping_city, shipping_postal_code, shipping_country, barbershops(name), marketplace_order_items(product_name, quantity, total)',
      )
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('[MARKETPLACE_ORDER_TRACK_LOOKUP_FAILED]', {
        code: orderError.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível consultar a encomenda neste momento.' },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    if (!order) return notFound();

    const { data: eventRows, error: eventError } = await db
      .from('marketplace_order_events')
      .select(
        'id, previous_status, new_status, customer_message, source, created_at',
      )
      .eq('order_id', order.id)
      .neq('source', 'manual_email')
      .order('created_at', { ascending: true })
      .limit(100);

    if (eventError) {
      console.error('[MARKETPLACE_ORDER_TRACK_HISTORY_FAILED]', {
        code: eventError.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { error: 'Não foi possível carregar o histórico da encomenda.' },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }

    const shop = Array.isArray(order.barbershops)
      ? order.barbershops[0]
      : order.barbershops;

    // The event table also records manual emails. Only lifecycle transitions
    // are relevant to the customer-facing timeline.
    const history = (eventRows ?? [])
      .filter((event) => event.source !== 'manual_email')
      .map((event) => ({
        id: event.id,
        previousStatus: event.previous_status,
        status: event.new_status,
        message:
          typeof event.customer_message === 'string'
            ? event.customer_message
            : null,
        createdAt: event.created_at,
      }));

    return NextResponse.json(
      {
        order: {
          reference: order.id.slice(0, 8),
          status: order.status,
          total: Number(order.total),
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          fulfillmentMethod: order.fulfillment_method,
          shipping:
            order.fulfillment_method === 'delivery'
              ? {
                  address: order.shipping_address,
                  city: order.shipping_city,
                  postalCode: order.shipping_postal_code,
                  country: order.shipping_country,
                }
              : null,
          shopName: typeof shop?.name === 'string' ? shop.name : 'Barbearia',
          items: (order.marketplace_order_items ?? []).map(
            (item: {
              product_name: string;
              quantity: number | string;
              total: number | string;
            }) => ({
              name: item.product_name,
              quantity: Number(item.quantity),
              total: Number(item.total),
            }),
          ),
          history,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[MARKETPLACE_ORDER_TRACK_UNEXPECTED_FAILURE]', {
      reason: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Não foi possível consultar a encomenda neste momento.' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}

export const POST = withApiObservability(
  '/api/marketplace/orders/track',
  POST__unobserved,
);
