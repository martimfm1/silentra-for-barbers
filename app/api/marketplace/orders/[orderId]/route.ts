import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { sendBrevoEmail } from '@/lib/email/brevo';
import {
  buildMarketplaceTrackingUrl,
  createMarketplaceTrackingToken,
  hashMarketplaceTrackingToken,
} from '@/lib/marketplace/tracking';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

const STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;
type Status = (typeof STATUSES)[number];

const canCancel = (status: Status) =>
  ['pending', 'confirmed', 'preparing', 'ready'].includes(status);

const customerMessage = (status: Status) => {
  switch (status) {
    case 'confirmed':
      return 'A tua encomenda foi confirmada.';
    case 'preparing':
      return 'A tua encomenda está a ser preparada.';
    case 'ready':
      return 'A tua encomenda está pronta.';
    case 'shipped':
      return 'A tua encomenda foi enviada.';
    case 'delivered':
      return 'A tua encomenda foi entregue.';
    case 'completed':
      return 'A tua encomenda foi concluída.';
    case 'cancelled':
      return 'A tua encomenda foi cancelada.';
    default:
      return null;
  }
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sanitizeOrderPayload(order: Record<string, unknown>) {
  const safe = { ...order };
  delete safe.tracking_token_hash;
  return safe;
}

async function notifyCustomer(
  admin: Awaited<ReturnType<typeof requireModuleContext>>['admin'],
  order: {
    id: string;
    customer_name: string;
    customer_email: string;
    status: Status;
  },
  barbershopId: string,
) {
  const message = customerMessage(order.status);
  if (!message) return;

  const { data: shop } = await admin
    .from('barbershops')
    .select('name')
    .eq('id', barbershopId)
    .maybeSingle();
  const shopName = shop?.name?.trim() || 'a tua barbearia';

  const subjectByStatus: Partial<Record<Status, string>> = {
    confirmed: 'A sua encomenda foi confirmada',
    preparing: 'A sua encomenda está a ser preparada',
    ready: 'A sua encomenda está pronta',
    shipped: 'A sua encomenda foi enviada',
    delivered: 'A sua encomenda foi entregue',
    completed: 'A sua encomenda foi concluída',
    cancelled: 'A sua encomenda foi cancelada',
  };
  const subject =
    subjectByStatus[order.status] || 'Atualização da sua encomenda';

  // Issue a fresh capability per status notification. Old receipt and status
  // links remain valid because each hash has its own row.
  let trackingUrl: string | null = null;
  const token = createMarketplaceTrackingToken();
  const candidateUrl = buildMarketplaceTrackingUrl(token);
  if (candidateUrl) {
    const { error: tokenError } = await admin
      .from('marketplace_order_tracking_tokens')
      .insert({
        order_id: order.id,
        token_hash: hashMarketplaceTrackingToken(token),
      });
    if (tokenError) {
      console.error('[MARKETPLACE_STATUS_TRACKING_TOKEN_SAVE_FAILED]', {
        orderId: order.id,
        status: order.status,
        code: tokenError.code ?? 'UNKNOWN',
      });
    } else {
      trackingUrl = candidateUrl;
    }
  } else {
    console.error('[MARKETPLACE_STATUS_TRACKING_LINK_UNAVAILABLE]', {
      orderId: order.id,
      status: order.status,
    });
  }

  try {
    const result = await sendBrevoEmail({
      to: order.customer_email,
      toName: order.customer_name,
      subject: `${subject} · ${shopName}`,
      senderName: shopName,
      // Capability links must not be used for recipient click/open analytics.
      contactPixelTrackingConsent: false,
      htmlContent: `<!doctype html><html lang="pt"><body style="margin:0;background:#09090b;font-family:Arial,Helvetica,sans-serif;color:#f4f4f5"><div style="max-width:620px;margin:0 auto;padding:40px 20px"><div style="border:1px solid #27272a;border-radius:24px;background:#0f0f11;padding:28px"><div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#34d399">SILENTRA · ${escapeHtml(shopName)}</div><h1 style="margin:14px 0 0;font-size:26px;color:#fff">${escapeHtml(subject)}</h1><p style="margin:18px 0 0;color:#d4d4d8;line-height:1.7">Olá ${escapeHtml(order.customer_name)}, ${escapeHtml(message)}</p><div style="margin-top:24px;padding:14px 16px;border-radius:14px;background:#18181b;border:1px solid #27272a;font-size:12px;color:#a1a1aa">Encomenda <span style="font-family:monospace;color:#fff">#${escapeHtml(order.id.slice(0, 8))}</span></div>${trackingUrl ? `<div style="margin-top:22px;text-align:center"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:13px 18px;border-radius:12px;background:#34d399;color:#052e24;font-weight:700;text-decoration:none">Acompanhar encomenda</a><p style="margin:10px 0 0;font-size:11px;color:#71717a">Link privado, sem necessidade de criar conta.</p></div>` : ''}<p style="margin:20px 0 0;font-size:12px;color:#71717a">Para questões sobre pagamento, levantamento ou entrega, contacta diretamente a barbearia.</p></div></div></body></html>`,
    });

    if (!result.success) {
      console.error('[MARKETPLACE_STATUS_EMAIL_FAILED]', {
        orderId: order.id,
        status: order.status,
        reason: 'provider_rejected',
      });
    }
  } catch {
    // The status transition is already committed; an email outage must not
    // make the API report that the order update itself failed.
    console.error('[MARKETPLACE_STATUS_EMAIL_FAILED]', {
      orderId: order.id,
      status: order.status,
      reason: 'provider_unavailable',
    });
  }
}

async function PATCH__unobserved(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { orderId } = await params;
    const body = (await request.json().catch(() => null)) as {
      status?: unknown;
    } | null;
    const status = typeof body?.status === 'string' ? body.status : '';

    if (!STATUSES.includes(status as Status)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }

    const { data: current, error: currentError } = await admin
      .from('marketplace_orders')
      .select('*')
      .eq('id', orderId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (currentError) {
      console.error(
        '[MARKETPLACE_ORDER_READ_ERROR]',
        currentError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar a encomenda.' },
        { status: 503 },
      );
    }
    if (!current) {
      return NextResponse.json(
        { error: 'Encomenda não encontrada.' },
        { status: 404 },
      );
    }
    if (current.status === status) {
      return NextResponse.json(
        { order: sanitizeOrderPayload(current) },
        { headers: { 'Cache-Control': 'no-store, private' } },
      );
    }

    let updated: unknown;
    if (status === 'cancelled') {
      if (!canCancel(current.status as Status)) {
        return NextResponse.json(
          { error: 'Esta encomenda já não pode ser cancelada neste estado.' },
          { status: 409 },
        );
      }
      const result = await admin.rpc('cancel_marketplace_order_atomic', {
        p_order_id: orderId,
        p_barbershop_id: barbershopId,
      });
      if (result.error || !result.data) {
        console.error(
          '[MARKETPLACE_ORDER_CANCEL_ERROR]',
          result.error?.code ?? 'UNKNOWN',
        );
        return NextResponse.json(
          { error: 'Não foi possível cancelar a encomenda.' },
          { status: 409 },
        );
      }
      updated = result.data;
    } else {
      const result = await admin.rpc('update_marketplace_order_status_atomic', {
        p_order_id: orderId,
        p_barbershop_id: barbershopId,
        p_next_status: status,
      });
      if (result.error || !result.data) {
        if (result.error?.code === 'P0001')
          return NextResponse.json(
            {
              error:
                'Esta encomenda não pode passar diretamente para esse estado.',
            },
            { status: 409 },
          );
        if (result.error?.code === 'P0002')
          return NextResponse.json(
            { error: 'Encomenda não encontrada.' },
            { status: 404 },
          );
        if (result.error?.code === '22023')
          return NextResponse.json(
            { error: 'Estado de encomenda inválido.' },
            { status: 400 },
          );
        console.error(
          '[MARKETPLACE_ORDER_STATUS_ERROR]',
          result.error?.code ?? 'UNKNOWN',
        );
        return NextResponse.json(
          { error: 'Não foi possível atualizar a encomenda.' },
          { status: 503 },
        );
      }
      updated = result.data;
    }

    const order = updated as typeof current;
    try {
      await notifyCustomer(admin, order, barbershopId);
    } catch (notificationError) {
      // A committed status transition must remain successful even if preparing
      // its notification unexpectedly throws. The seller can safely retry the
      // notification separately rather than repeating the transition.
      console.error('[MARKETPLACE_STATUS_NOTIFICATION_FAILED]', {
        orderId: order.id,
        status: order.status,
        reason:
          notificationError instanceof Error
            ? notificationError.name
            : 'UNKNOWN',
      });
    }
    return NextResponse.json(
      { order: sanitizeOrderPayload(order as Record<string, unknown>) },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível atualizar a encomenda.' },
      { status: 500 },
    );
  }
}

export const PATCH = withApiObservability(
  '/api/marketplace/orders/[orderId]',
  PATCH__unobserved,
);
