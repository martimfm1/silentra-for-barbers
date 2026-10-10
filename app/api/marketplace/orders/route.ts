import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBrevoEmail } from '@/lib/email/brevo';
import { consumePublicRateLimit } from '@/lib/security/public-rate-limit';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';

export const runtime = 'nodejs';

const FULFILLMENT_METHODS = ['pickup', 'delivery'] as const;
type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NormalizedOrderItem = {
  productId: string;
  quantity: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function buildOrderReceiptEmail(input: {
  customerName: string;
  shopName: string;
  orderId: string;
  total: number;
  fulfillmentMethod: FulfillmentMethod;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  items: Array<{ product_name: string; quantity: number; total: number }>;
}) {
  const fulfillmentLabel =
    input.fulfillmentMethod === 'delivery'
      ? 'Entrega'
      : 'Levantamento na barbearia';
  const itemsHtml = input.items
    .map(
      (item) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #27272a;color:#f4f4f5;">${escapeHtml(item.product_name)} <span style="color:#71717a;">× ${item.quantity}</span></td><td style="padding:12px 0;border-bottom:1px solid #27272a;text-align:right;color:#f4f4f5;">${formatMoney(Number(item.total))}</td></tr>`,
    )
    .join('');
  const shippingHtml =
    input.fulfillmentMethod === 'delivery'
      ? `<div style="margin-top:20px;padding:16px;border:1px solid #27272a;border-radius:14px;background:#18181b;"><div style="font-size:12px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em;">Entrega</div><div style="margin-top:8px;color:#f4f4f5;line-height:1.6;">${escapeHtml(input.shippingAddress ?? '')}<br>${escapeHtml(input.shippingPostalCode ?? '')} ${escapeHtml(input.shippingCity ?? '')}</div><div style="margin-top:8px;font-size:12px;color:#a1a1aa;">O envio é tratado diretamente pela barbearia.</div></div>`
      : `<div style="margin-top:20px;padding:16px;border:1px solid #27272a;border-radius:14px;background:#18181b;"><div style="font-size:12px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em;">Levantamento</div><div style="margin-top:8px;color:#f4f4f5;">A ${escapeHtml(input.shopName)} vai contactar-te quando a encomenda estiver pronta.</div></div>`;

  return `<!doctype html><html lang="pt"><body style="margin:0;background:#09090b;font-family:Arial,Helvetica,sans-serif;color:#f4f4f5;"><div style="max-width:620px;margin:0 auto;padding:40px 20px;"><div style="border:1px solid #27272a;border-radius:24px;background:#0f0f11;padding:28px;"><div style="font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#34d399;">SILENTRA · COMPROVATIVO</div><h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;color:#fff;">Encomenda recebida</h1><p style="margin:14px 0 0;color:#a1a1aa;line-height:1.6;">Olá ${escapeHtml(input.customerName)}, recebemos a tua encomenda na <strong style="color:#e4e4e7;">${escapeHtml(input.shopName)}</strong>.</p><div style="margin-top:24px;padding:14px 16px;border-radius:14px;background:#18181b;border:1px solid #27272a;"><div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">Pedido</div><div style="margin-top:5px;font-family:monospace;color:#fff;">${escapeHtml(input.orderId)}</div><div style="margin-top:12px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.08em;">Forma</div><div style="margin-top:5px;color:#fff;">${fulfillmentLabel}</div></div><table style="width:100%;margin-top:24px;border-collapse:collapse;"><tbody>${itemsHtml}</tbody></table><div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:16px;border-top:1px solid #27272a;font-size:18px;"><span style="color:#a1a1aa;">Total</span><strong style="color:#fff;">${formatMoney(input.total)}</strong></div>${shippingHtml}<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Este email é um comprovativo da encomenda, não uma fatura. Qualquer questão sobre pagamento, entrega ou devolução deve ser tratada diretamente com a barbearia.</p></div><p style="padding:20px 8px 0;text-align:center;font-size:11px;color:#52525b;">SILENTRA · You think. We do.</p></div></body></html>`;
}

async function GET__unobserved() {
  try {
    const { admin, barbershopId } = await requireModuleContext('pos', 'pos');
    const { data, error } = await admin
      .from('marketplace_orders')
      .select('*, marketplace_order_items(*), marketplace_order_events(*)')
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: 'Não foi possível carregar as encomendas.' },
      { status: 500 },
    );
  }
}

async function POST__unobserved(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const customerName =
      typeof body?.customerName === 'string' ? body.customerName.trim() : '';
    const customerEmail =
      typeof body?.customerEmail === 'string'
        ? body.customerEmail.trim().toLowerCase()
        : '';
    const customerPhone =
      typeof body?.customerPhone === 'string' ? body.customerPhone.trim() : '';
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
    const shopId =
      typeof body?.barbershopId === 'string' ? body.barbershopId : '';
    const fulfillmentMethod =
      typeof body?.fulfillmentMethod === 'string'
        ? body.fulfillmentMethod
        : 'pickup';
    const shipping =
      body?.shipping && typeof body.shipping === 'object'
        ? (body.shipping as Record<string, unknown>)
        : {};
    const shippingAddress =
      typeof shipping.address === 'string' ? shipping.address.trim() : '';
    const shippingCity =
      typeof shipping.city === 'string' ? shipping.city.trim() : '';
    const shippingPostalCode =
      typeof shipping.postalCode === 'string' ? shipping.postalCode.trim() : '';
    const shippingCountry =
      typeof shipping.country === 'string' ? shipping.country.trim() : 'PT';
    const items = Array.isArray(body?.items) ? body.items.slice(0, 30) : [];

    if (
      customerName.length < 2 ||
      customerEmail.length < 5 ||
      !customerEmail.includes('@') ||
      customerPhone.length < 6 ||
      !shopId ||
      items.length === 0
    )
      return NextResponse.json(
        { error: 'Preenche os teus dados e adiciona pelo menos um produto.' },
        { status: 400 },
      );
    if (!UUID_PATTERN.test(shopId))
      return NextResponse.json(
        { error: 'Barbearia inválida.' },
        { status: 400 },
      );
    if (!FULFILLMENT_METHODS.includes(fulfillmentMethod as FulfillmentMethod))
      return NextResponse.json(
        { error: 'Escolhe uma forma de entrega válida.' },
        { status: 400 },
      );
    if (
      fulfillmentMethod === 'delivery' &&
      (!shippingAddress || !shippingCity || !shippingPostalCode)
    )
      return NextResponse.json(
        { error: 'Preenche a morada de entrega.' },
        { status: 400 },
      );

    const normalizedItems: NormalizedOrderItem[] = items.map((rawItem) => {
      const item =
        rawItem && typeof rawItem === 'object'
          ? (rawItem as Record<string, unknown>)
          : {};
      return {
        productId: typeof item.productId === 'string' ? item.productId : '',
        quantity: Number(item.quantity),
      };
    });
    if (
      normalizedItems.some(
        (item) =>
          !UUID_PATTERN.test(item.productId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > 50,
      )
    )
      return NextResponse.json(
        { error: 'O carrinho contém produtos inválidos.' },
        { status: 400 },
      );

    const allowed = await consumePublicRateLimit(
      request,
      'marketplace-order-create',
      `${shopId}:${customerEmail}`,
      5,
      300,
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            'Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.',
        },
        { status: 429, headers: { 'Retry-After': '300' } },
      );
    }

    const db = createAdminClient();
    const { data, error } = await db.rpc('create_marketplace_order_atomic', {
      p_barbershop_id: shopId,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_customer_phone: customerPhone,
      p_notes: notes || null,
      p_items: normalizedItems,
      p_fulfillment_method: fulfillmentMethod,
      p_shipping_address:
        fulfillmentMethod === 'delivery' ? shippingAddress : null,
      p_shipping_city: fulfillmentMethod === 'delivery' ? shippingCity : null,
      p_shipping_postal_code:
        fulfillmentMethod === 'delivery' ? shippingPostalCode : null,
      p_shipping_country:
        fulfillmentMethod === 'delivery' ? shippingCountry : null,
    });

    if (error || !data) {
      const message = error?.message ?? 'Não foi possível criar a encomenda.';
      return NextResponse.json(
        {
          error: /stock|unavailable/i.test(message)
            ? 'Um dos produtos deixou de ter stock suficiente. Atualiza o carrinho e tenta novamente.'
            : message,
        },
        { status: 409 },
      );
    }

    const order = Array.isArray(data) ? data[0] : data;
    const { data: details } = await db
      .from('marketplace_orders')
      .select('*, marketplace_order_items(*), barbershops(name)')
      .eq('id', order.id)
      .maybeSingle();
    const itemsForEmail = details?.marketplace_order_items ?? [];
    const shopRelation = Array.isArray(details?.barbershops)
      ? details.barbershops[0]
      : details?.barbershops;
    const shopName =
      typeof shopRelation?.name === 'string'
        ? shopRelation.name
        : 'a tua barbearia';

    let emailSent = false;
    try {
      const email = await sendBrevoEmail({
        to: customerEmail,
        toName: customerName,
        subject: `Comprovativo da encomenda #${order.id.slice(0, 8)} · ${shopName}`,
        senderName: shopName,
        htmlContent: buildOrderReceiptEmail({
          customerName,
          shopName,
          orderId: order.id,
          total: Number(order.total),
          fulfillmentMethod: fulfillmentMethod as FulfillmentMethod,
          shippingAddress: order.shipping_address,
          shippingCity: order.shipping_city,
          shippingPostalCode: order.shipping_postal_code,
          items: itemsForEmail.map(
            (item: {
              product_name: string;
              quantity: number;
              total: number;
            }) => ({
              product_name: item.product_name,
              quantity: Number(item.quantity),
              total: Number(item.total),
            }),
          ),
        }),
      });
      emailSent = email.success;
      if (!email.success)
        console.error('[MARKETPLACE_RECEIPT_EMAIL_FAILED]', {
          orderId: order.id,
          error: email.error,
        });
    } catch (emailError) {
      console.error('[MARKETPLACE_RECEIPT_EMAIL_FAILED]', {
        orderId: order.id,
        error: emailError,
      });
    }

    return NextResponse.json({ order, emailSent }, { status: 201 });
  } catch (error) {
    console.error('[MARKETPLACE_ORDER_API]', error);
    return NextResponse.json(
      { error: 'Não foi possível concluir a encomenda.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/marketplace/orders', GET__unobserved);
export const POST = withApiObservability('/api/marketplace/orders', POST__unobserved);
