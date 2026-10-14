import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { createClient } from '@/lib/supabase/server';
import { BillingService } from '@/services/billing/billing.service';
import { PaymentModeService } from '@/services/billing/payment-mode.service';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import {
  assertSameOrigin,
  billingErrorResponse,
  readJsonObject,
} from '@/services/billing/http';
import { verifyCheckoutIntent } from '@/lib/stripe/checkout-intent';
import { quoteManualPrice } from '@/lib/billing/manual-promotions';
import { BillingError } from '@/types/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Inicia sessão para validar um código promocional.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const body = await readJsonObject(request);
    const token =
      typeof body.checkoutToken === 'string'
        ? body.checkoutToken.trim()
        : '';
    const rawCode =
      typeof body.promotionCode === 'string'
        ? body.promotionCode.trim()
        : '';

    if (!token || token.length > 4096) {
      return NextResponse.json(
        { error: 'O checkout expirou. Inicia novamente a partir dos planos.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (rawCode.length > 100) {
      return NextResponse.json(
        { error: 'O código promocional é demasiado longo.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const intent = verifyCheckoutIntent(token);
    if (!intent || intent.sub !== user.id || !intent.barbershopId) {
      return NextResponse.json(
        { error: 'O checkout expirou ou não pertence à tua conta.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const mode = await PaymentModeService.getPaymentMode();
    if (mode !== 'MANUAL') {
      return NextResponse.json(
        {
          error:
            'Os códigos promocionais deste checkout só estão disponíveis no pagamento manual.',
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    await BillingService.assertBillingOwner(user.id);
    const tenant = await BarbershopStripeService.getTenantContext(user.id);
    if (tenant.barbershopId !== intent.barbershopId) {
      return NextResponse.json(
        {
          error:
            'A barbearia associada ao checkout mudou. Inicia novamente o checkout.',
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (intent.plan !== 'pro' && intent.plan !== 'enterprise') {
      return NextResponse.json(
        { error: 'O plano selecionado não é válido.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const quote = quoteManualPrice(intent.plan, intent.interval, rawCode);
    return NextResponse.json(
      { ok: true, pricing: quote },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response =
      error instanceof BillingError
        ? billingErrorResponse(error)
        : NextResponse.json(
            { error: 'Não foi possível validar o código promocional. Tenta novamente.' },
            { status: 500 },
          );
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}

export const POST = withApiObservability(
  '/api/billing/manual-promotion',
  POST__unobserved,
);
