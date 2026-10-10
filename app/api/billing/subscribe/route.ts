import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PLANS } from '@/lib/stripe/constants';
import { PLAN_ACCESS_STATUSES } from '@/lib/billing/plan-access';
import { BillingService } from '@/services/billing/billing.service';
import {
  PaymentModeService,
  type PaymentMode,
} from '@/services/billing/payment-mode.service';
import { SubscriptionService } from '@/services/billing/subscription.service';
import { createCheckoutIntent } from '@/lib/stripe/checkout-intent';
import { StripePriceService } from '@/services/billing/stripe-price.service';
import { BillingError } from '@/types/stripe';

type Plan = 'pro' | 'enterprise';
type Interval = 'month' | 'year';

function readPlan(value: unknown): Plan | null {
  return value === PLANS.PRO || value === PLANS.ENTERPRISE ? value : null;
}

function readInterval(value: unknown): Interval {
  return value === 'year' ? 'year' : 'month';
}

function modeLabel(mode: PaymentMode) {
  return mode === 'MANUAL' ? 'Pagamento Manual' : 'Stripe';
}

async function POSTHandler(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email)
      return NextResponse.json(
        { error: 'Não tens sessão iniciada.' },
        { status: 401 },
      );

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const plan = readPlan(body?.plan);
    const interval = readInterval(body?.interval);

    if (!plan)
      return NextResponse.json(
        { error: 'O plano selecionado não é válido.' },
        { status: 400 },
      );

    await BillingService.assertBillingOwner(user.id);

    const mode = await PaymentModeService.getPaymentMode();

    const admin = (await import('@/lib/supabase/admin')).createAdminClient();
    const { data: profile } = await admin
      .from('users')
      .select('id, name_complete, email, barbershop_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.barbershop_id) {
      throw new BillingError(
        'A tua conta ainda não está associada a uma barbearia.',
        'SUBSCRIPTION_NOT_FOUND',
      );
    }

    const existing = await admin
      .from('subscriptions')
      .select(
        'id, plan, status, payment_method, stripe_subscription_id, current_period_end',
      )
      .eq('barbershop_id', profile.barbershop_id)
      .maybeSingle();

    if (existing.error)
      throw new BillingError(
        'Não foi possível verificar a subscrição atual.',
        'DB_READ_FAILED',
      );

    const hasActivePaid = Boolean(
      existing.data &&
      existing.data.plan !== PLANS.FREE &&
      (PLAN_ACCESS_STATUSES as readonly string[]).includes(
        existing.data.status,
      ),
    );
    const existingPaymentMethod =
      existing.data?.payment_method === 'STRIPE' ? 'STRIPE' : 'MANUAL';

    // Existing subscriptions never migrate when the global mode changes.
    // A Stripe subscription therefore continues using the Stripe flow.
    const useExistingStripeFlow =
      hasActivePaid && existingPaymentMethod === 'STRIPE';

    const useManualFlow = hasActivePaid
      ? existingPaymentMethod === 'MANUAL'
      : mode === 'MANUAL';

    if (useManualFlow) {
      // Manual billing always goes through the dedicated customer-information
      // checkout. No subscription request is created until the form is submitted.
      const checkoutIntent = createCheckoutIntent(
        user.id,
        profile.barbershop_id,
        plan,
        interval,
      );

      const query = new URLSearchParams({
        intent: checkoutIntent,
      });

      return NextResponse.json(
        {
          mode,
          message: 'A abrir o checkout de pagamento manual.',
          redirectUrl: `/checkout/manual?${query.toString()}`,
        },
        {
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }

    // The Stripe price is resolved and validated exclusively on the server.
    // Its ID is intentionally never exposed in the checkout URL.
    await StripePriceService.resolveVerifiedPrice(plan, interval);

    const current = await SubscriptionService.getActiveForUser(user.id);
    const changingPlan = Boolean(
      current &&
      current.plan !== PLANS.FREE &&
      current.plan !== plan &&
      (PLAN_ACCESS_STATUSES as readonly string[]).includes(current.status),
    );

    const checkoutIntent = createCheckoutIntent(
      user.id,
      profile.barbershop_id,
      plan,
      interval,
    );

    const query = new URLSearchParams({
      intent: checkoutIntent,
    });
    if (changingPlan) query.set('change', '1');

    return NextResponse.json(
      {
        mode,
        message: `A abrir o checkout ${modeLabel(mode)}.`,
        redirectUrl: `/checkout?${query.toString()}`,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    const status =
      error instanceof BillingError && error.code === 'INVALID_PRICE'
        ? 400
        : error instanceof BillingError &&
            ['SUBSCRIPTION_NOT_ACTIVE', 'SUBSCRIPTION_NOT_FOUND'].includes(
              error.code,
            )
          ? 409
          : 500;

    console.error('[BILLING_SUBSCRIBE]', {
      error: error instanceof Error ? error.name : 'UNKNOWN',
      code: error instanceof BillingError ? error.code : undefined,
    });

    return NextResponse.json(
      {
        error:
          error instanceof BillingError
            ? error.message
            : 'Não foi possível iniciar o processo de subscrição.',
      },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}


export const POST = withApiLogging('/api/billing/subscribe', POSTHandler);
