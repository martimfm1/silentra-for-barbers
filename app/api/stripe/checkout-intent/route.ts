import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import {
  PLANS,
  type CheckoutInterval,
  type CheckoutPlan,
} from '@/lib/stripe/constants';
import { createCheckoutIntent } from '@/lib/stripe/checkout-intent';
import { StripePriceService } from '@/services/billing/stripe-price.service';
import {
  billingErrorResponse,
  assertSameOrigin,
  readJsonObject,
} from '@/services/billing/http';
import { BillingError } from '@/types/stripe';
import { PLAN_ACCESS_STATUSES } from '@/lib/billing/plan-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePlan(value: unknown): CheckoutPlan {
  if (value === PLANS.PRO || value === PLANS.ENTERPRISE) return value;
  throw new BillingError('O plano selecionado não é válido.', 'INVALID_PRICE');
}

function parseInterval(value: unknown): CheckoutInterval {
  if (value === 'year') return 'year';
  if (value === undefined || value === null || value === 'month')
    return 'month';
  throw new BillingError(
    'O período de faturação selecionado não é válido.',
    'INVALID_PRICE',
  );
}

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Não tens sessão iniciada.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const body = await readJsonObject(request);
    const plan = parsePlan(body.plan);
    const interval = parseInterval(body.interval);

    const tenant = await BarbershopStripeService.getTenantContext(user.id);

    const existing = await BarbershopStripeService.reconcileSubscription(
      tenant.barbershopId,
      await BarbershopStripeService.getSubscriptionForBarbershop(
        tenant.barbershopId,
      ),
    );

    if (
      existing?.stripe_subscription_id &&
      existing.plan !== PLANS.FREE &&
      (PLAN_ACCESS_STATUSES as readonly string[]).includes(existing.status)
    ) {
      throw new BillingError(
        'Já existe uma subscrição ativa. Para mudar de plano, inicia uma alteração de plano a partir da faturação.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    }

    // Verification 1: resolve the price exclusively from server-side configuration
    // instead of trusting anything supplied by the browser.
    await StripePriceService.resolveVerifiedPrice(plan, interval);

    // The signed intent binds the checkout to the authenticated user, tenant,
    // selected plan/interval and short expiry. The actual Stripe price ID is
    // deliberately never placed in the URL or returned to the browser.
    const token = createCheckoutIntent(
      tenant.userId,
      tenant.barbershopId,
      plan,
      interval,
    );

    return NextResponse.json(
      {
        checkoutToken: token,
        plan,
        interval,
        expiresInSeconds: 10 * 60,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export const POST = withApiObservability('/api/stripe/checkout-intent', POST__unobserved);
