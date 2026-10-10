import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function POSTHandler(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { orderId } = await params;
    const body = (await request.json().catch(() => null)) as {
      subject?: unknown;
      message?: unknown;
    } | null;

    const subject =
      typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message =
      typeof body?.message === 'string' ? body.message.trim() : '';

    if (
      subject.length < 3 ||
      subject.length > 180 ||
      message.length < 3 ||
      message.length > 5000
    ) {
      return NextResponse.json(
        { error: 'Indica um assunto e uma mensagem válidos.' },
        { status: 400 },
      );
    }

    const { data: order, error: orderError } = await admin
      .from('marketplace_orders')
      .select('id,customer_name,customer_email,barbershop_id,status')
      .eq('id', orderId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (orderError) {
      console.error(
        '[MARKETPLACE_ORDER_EMAIL_ORDER_ERROR]',
        orderError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Não foi possível carregar a encomenda.' },
        { status: 503 },
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Encomenda não encontrada.' },
        { status: 404 },
      );
    }

    const { data: shop } = await admin
      .from('barbershops')
      .select('name')
      .eq('id', barbershopId)
      .maybeSingle();

    const shopName = shop?.name?.trim() || 'a tua barbearia';
    const htmlContent = `<!doctype html><html lang="pt"><body style="margin:0;background:#09090b;font-family:Arial,Helvetica,sans-serif;color:#f4f4f5"><div style="max-width:620px;margin:0 auto;padding:40px 20px"><div style="border:1px solid #27272a;border-radius:24px;background:#0f0f11;padding:28px"><div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#34d399">SILENTRA · ${escapeHtml(shopName)}</div><h1 style="margin:14px 0 0;font-size:26px;color:#fff">${escapeHtml(subject)}</h1><p style="margin:18px 0 0;color:#d4d4d8;line-height:1.7;white-space:pre-wrap">${escapeHtml(message)}</p><div style="margin-top:24px;padding:14px 16px;border-radius:14px;background:#18181b;border:1px solid #27272a;font-size:12px;color:#a1a1aa">Encomenda <span style="font-family:monospace;color:#fff">#${escapeHtml(order.id.slice(0, 8))}</span></div></div><p style="padding:20px 8px 0;text-align:center;font-size:11px;color:#52525b">Mensagem enviada pela barbearia através da SILENTRA.</p></div></body></html>`;

    const result = await sendBrevoEmail({
      to: order.customer_email,
      toName: order.customer_name,
      subject,
      senderName: shopName,
      htmlContent,
    });

    if (!result.success) {
      console.error('[MARKETPLACE_ORDER_EMAIL_SEND_FAILED]', {
        orderId,
        error: result.error,
      });
      return NextResponse.json(
        { error: 'Não foi possível enviar o email ao cliente.' },
        { status: 503 },
      );
    }

    const { error: eventError } = await admin
      .from('marketplace_order_events')
      .insert({
        order_id: order.id,
        barbershop_id: barbershopId,
        previous_status: null,
        new_status: order.status,
        actor_user_id: auth.user?.id ?? null,
        source: 'manual_email',
        customer_message: `Email enviado ao cliente: ${subject}`,
        metadata: { subject },
      });
    if (eventError) {
      console.error(
        '[MARKETPLACE_ORDER_EMAIL_EVENT_LOG_FAILED]',
        eventError.code ?? 'UNKNOWN',
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('[MARKETPLACE_ORDER_EMAIL_API]', error);
    return NextResponse.json(
      { error: 'Não foi possível enviar o email ao cliente.' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging(
  '/api/marketplace/orders/[orderId]/email',
  POSTHandler,
);
