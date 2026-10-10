import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import { ManualPaymentService } from '@/services/billing/manual-payment.service';
import { PaymentModeService } from '@/services/billing/payment-mode.service';
import { BillingError } from '@/types/stripe';
import { verifyCheckoutIntent } from '@/lib/stripe/checkout-intent';
import { PLANS } from '@/lib/stripe/constants';

type Details = {
  billingName?: unknown;
  taxId?: unknown;
  billingEmail?: unknown;
  phone?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  postalCode?: unknown;
  city?: unknown;
  country?: unknown;
  website?: unknown;
  businessType?: unknown;
  locationCount?: unknown;
  teamSize?: unknown;
  customerMessage?: unknown;
};

function clean(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const valueTrimmed = value.trim();
  return valueTrimmed ? valueTrimmed.slice(0, max) : null;
}

function positiveInt(value: unknown, max: number): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) return null;
  return number;
}

function email(value: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function website(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function POST__unobserved(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Não tens sessão iniciada.' },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      checkoutToken?: unknown;
      details?: Details;
    } | null;

    const token = clean(body?.checkoutToken, 4096);
    const intent = token ? verifyCheckoutIntent(token) : null;

    if (!intent || intent.sub !== user.id) {
      return NextResponse.json(
        { error: 'O checkout expirou ou não pertence à tua conta.' },
        { status: 403 },
      );
    }

    if (intent.barbershopId === '') {
      return NextResponse.json(
        { error: 'A barbearia associada ao checkout é inválida.' },
        { status: 400 },
      );
    }

    const plan = intent.plan;
    if (plan !== PLANS.PRO && plan !== PLANS.ENTERPRISE) {
      return NextResponse.json(
        { error: 'O plano selecionado não é válido.' },
        { status: 400 },
      );
    }

    const mode = await PaymentModeService.getPaymentMode();
    if (mode !== 'MANUAL') {
      return NextResponse.json(
        {
          error:
            'O pagamento manual já não está disponível. Volta aos planos para continuar.',
        },
        { status: 409 },
      );
    }

    await BillingService.assertBillingOwner(user.id);

    const details = body?.details ?? {};
    const billingName = clean(details.billingName, 160);
    const billingEmail =
      clean(details.billingEmail, 254)?.toLowerCase() ?? null;
    const phone = clean(details.phone, 40);
    const addressLine1 = clean(details.addressLine1, 200);
    const addressLine2 = clean(details.addressLine2, 200);
    const postalCode = clean(details.postalCode, 30);
    const city = clean(details.city, 100);
    const country = (clean(details.country, 2) ?? 'PT').toUpperCase();
    const taxId = clean(details.taxId, 40);
    const businessType = clean(details.businessType, 80);
    const customerMessage = clean(details.customerMessage, 2000);
    const websiteValue = clean(details.website, 300);
    const websiteUrl = website(websiteValue);
    const locationCount = positiveInt(details.locationCount, 10000);
    const teamSize = positiveInt(details.teamSize, 100000);

    if (
      !billingName ||
      !billingEmail ||
      !phone ||
      !addressLine1 ||
      !postalCode ||
      !city
    ) {
      return NextResponse.json(
        {
          error:
            'Preenche todos os campos obrigatórios de faturação antes de continuar.',
        },
        { status: 400 },
      );
    }

    if (!email(billingEmail)) {
      return NextResponse.json(
        { error: 'Introduz um email de faturação válido.' },
        { status: 400 },
      );
    }

    if (!/^[A-Z]{2}$/.test(country)) {
      return NextResponse.json(
        { error: 'Seleciona um país válido.' },
        { status: 400 },
      );
    }

    if (websiteValue && !websiteUrl) {
      return NextResponse.json(
        { error: 'O website introduzido não é válido.' },
        { status: 400 },
      );
    }

    if (
      details.locationCount !== '' &&
      details.locationCount !== undefined &&
      details.locationCount !== null &&
      locationCount === null
    ) {
      return NextResponse.json(
        { error: 'O número de localizações não é válido.' },
        { status: 400 },
      );
    }

    if (
      details.teamSize !== '' &&
      details.teamSize !== undefined &&
      details.teamSize !== null &&
      teamSize === null
    ) {
      return NextResponse.json(
        { error: 'O número de elementos da equipa não é válido.' },
        { status: 400 },
      );
    }

    const admin = (await import('@/lib/supabase/admin')).createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('id, name_complete, email, barbershop_id')
      .eq('id', user.id)
      .maybeSingle();

    if (
      !profile?.barbershop_id ||
      profile.barbershop_id !== intent.barbershopId
    ) {
      return NextResponse.json(
        {
          error:
            'A barbearia associada à tua conta mudou. Inicia novamente o checkout.',
        },
        { status: 409 },
      );
    }

    const existing = await admin
      .from('subscriptions')
      .select('id, plan, status, payment_method')
      .eq('barbershop_id', profile.barbershop_id)
      .maybeSingle();

    if (existing.error) {
      throw new BillingError(
        'Não foi possível verificar a subscrição atual.',
        'DB_READ_FAILED',
      );
    }

    const hasActivePaid = Boolean(
      existing.data &&
      existing.data.plan !== PLANS.FREE &&
      ['active', 'trialing'].includes(existing.data.status),
    );

    const requestType = hasActivePaid ? 'CHANGE' : 'NEW';

    const row = await ManualPaymentService.createRequest({
      userId: user.id,
      barbershopId: profile.barbershop_id,
      plan,
      billingInterval: intent.interval,
      requestType,
      details: {
        billingName,
        taxId,
        billingEmail,
        phone,
        addressLine1,
        addressLine2,
        postalCode,
        city,
        country,
        website: websiteUrl,
        businessType,
        locationCount,
        teamSize,
        customerMessage,
      },
    });

    const { data: shop } = await admin
      .from('barbershops')
      .select('name')
      .eq('id', profile.barbershop_id)
      .maybeSingle();

    const notification = await ManualPaymentService.notifyAdmin(row, {
      customerName: billingName,
      customerEmail: billingEmail,
      barbershopName: shop?.name || 'Barbearia',
      appOrigin: new URL(request.url).origin,
    });

    return NextResponse.json(
      {
        ok: true,
        request: {
          id: row.id,
          status: row.status,
          plan: row.plan,
          billingInterval: row.billing_interval,
          price: row.price,
          currency: row.currency,
        },
        adminNotificationSent: notification.sent,
        redirectUrl: `/dashboard/billing?manual=pending&request_id=${encodeURIComponent(row.id)}`,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const status =
      error instanceof BillingError && ['INVALID_PRICE'].includes(error.code)
        ? 400
        : error instanceof BillingError &&
            ['SUBSCRIPTION_NOT_ACTIVE', 'SUBSCRIPTION_NOT_FOUND'].includes(
              error.code,
            )
          ? 409
          : 500;

    console.error('[MANUAL_CHECKOUT]', {
      error: error instanceof Error ? error.name : 'UNKNOWN',
      code: error instanceof BillingError ? error.code : undefined,
    });

    return NextResponse.json(
      {
        error:
          error instanceof BillingError
            ? error.message
            : 'Não foi possível enviar o pedido de subscrição.',
      },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const POST = withApiObservability(
  '/api/billing/manual-checkout',
  POST__unobserved,
);
