import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import {
  PLANS,
  intervalForPriceId,
  planForPrice,
} from '@/lib/stripe/constants';
import { resolvePlan } from '@/lib/billing/plan-access';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { PaymentModeService } from '@/services/billing/payment-mode.service';
import { ManualPaymentService } from '@/services/billing/manual-payment.service';
import type { BillingPlan, SubscriptionRecord } from '@/types/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );

    const paymentMode = await PaymentModeService.getPaymentMode();
    const database = createAdminClient();
    const { data: userRow, error: userError } = await database
      .from('users')
      .select('barbershop_id, role, email')
      .eq('id', user.id)
      .maybeSingle();
    if (userError) {
      console.error(
        '[BILLING_SUMMARY_USER_ERROR]',
        userError.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Could not load billing account.' },
        { status: 500 },
      );
    }

    const barbershopId = userRow?.barbershop_id ?? null;
    if (!barbershopId)
      return NextResponse.json(
        {
          subscription: null,
          plan: PLANS.FREE,
          planSource: 'free',
          cancellation: null,
          isAuthenticated: true,
          isBillingOwner: false,
          barbershopId: null,
          barbershopName: null,
          billingInterval: null,
          paymentMode,
          manualRequest: null,
        },
        {
          headers: {
            'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
          },
        },
      );

    const [subscriptionResult, assignmentResult, barbershopResult] =
      await Promise.all([
        database
          .from('subscriptions')
          .select(
            'id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, cancel_at_period_end, current_period_end, trial_end, plan, plan_override, payment_method, updated_at',
          )
          .eq('barbershop_id', barbershopId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        database
          .from('barbershop_plan_assignments')
          .select('plan, expires_at')
          .eq('barbershop_id', barbershopId)
          .maybeSingle(),
        database
          .from('barbershops')
          .select('id, name')
          .eq('id', barbershopId)
          .maybeSingle(),
      ]);

    if (subscriptionResult.error) {
      console.error(
        '[BILLING_SUMMARY_SUBSCRIPTION_ERROR]',
        subscriptionResult.error.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Could not load subscription.' },
        { status: 500 },
      );
    }
    if (assignmentResult.error) {
      console.error(
        '[BILLING_SUMMARY_ASSIGNMENT_ERROR]',
        assignmentResult.error.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Could not load plan assignment.' },
        { status: 500 },
      );
    }
    if (barbershopResult.error) {
      console.error(
        '[BILLING_SUMMARY_BARBERSHOP_ERROR]',
        barbershopResult.error.code ?? 'UNKNOWN',
      );
      return NextResponse.json(
        { error: 'Could not load barbershop.' },
        { status: 500 },
      );
    }

    let subscription = subscriptionResult.data as SubscriptionRecord | null;

    // Stripe is the billing source of truth. Reconcile on every billing-page
    // read so a missed/delayed webhook cannot leave the dashboard showing
    // "cancelamento agendado" after Stripe has already canceled the subscription.
    if (subscription?.stripe_subscription_id && !subscription.plan_override) {
      subscription = await BarbershopStripeService.reconcileSubscription(
        barbershopId,
        subscription,
      );
    }

    const assignment = assignmentResult.data;
    const hasActiveAssignment = Boolean(
      assignment &&
      (!assignment.expires_at ||
        new Date(assignment.expires_at).getTime() > Date.now()),
    );

    let cancellation: {
      canceledAt: string | null;
      canceledByName: string | null;
      canceledByEmail: string | null;
      previousPlan: BillingPlan | null;
      requestedAt: string | null;
    } | null = null;

    if (subscription?.status === 'canceled') {
      try {
        const stripe = getStripeClient();
        const remote = subscription.stripe_subscription_id
          ? await stripe.subscriptions.retrieve(
              subscription.stripe_subscription_id,
            )
          : null;

        const canceledAt = remote?.canceled_at
          ? new Date(remote.canceled_at * 1000).toISOString()
          : null;
        const previousPlan =
          planForPrice(remote?.items.data[0]?.price.id ?? '') ??
          planForPrice(subscription.stripe_price_id ?? '') ??
          (subscription.plan === PLANS.FREE ? null : subscription.plan);
        const canceledByUserId =
          remote?.metadata?.cancellation_requested_by_user_id?.trim() ||
          remote?.metadata?.user_id?.trim() ||
          subscription.user_id;

        let canceledByName: string | null = null;
        let canceledByEmail: string | null = null;
        if (canceledByUserId) {
          const { data: canceledByUser } = await database
            .from('users')
            .select('name_complete, name, email')
            .eq('id', canceledByUserId)
            .maybeSingle();
          if (canceledByUser) {
            canceledByName =
              canceledByUser.name_complete?.trim() ||
              canceledByUser.name?.trim() ||
              null;
            canceledByEmail = canceledByUser.email ?? null;
          }
        }

        cancellation = {
          canceledAt,
          canceledByName,
          canceledByEmail,
          previousPlan,
          requestedAt: remote?.metadata?.cancellation_requested_at ?? null,
        };
      } catch (error) {
        console.error(
          '[BILLING_SUMMARY_CANCELLATION_SYNC_ERROR]',
          error instanceof Error ? error.name : 'UNKNOWN',
        );
        cancellation = null;
      }
    }

    const manualFlow =
      subscription?.payment_method === 'MANUAL' ||
      (!subscription?.stripe_subscription_id && paymentMode === 'MANUAL');
    const manualRequest = manualFlow
      ? await ManualPaymentService.getRequestForUser(user.id)
      : null;
    const billingInterval =
      subscription?.payment_method === 'MANUAL'
        ? (manualRequest?.billing_interval ?? null)
        : intervalForPriceId(subscription?.stripe_price_id);

    const plan: BillingPlan =
      hasActiveAssignment && assignment
        ? (assignment.plan as BillingPlan)
        : subscription?.plan_override &&
            subscription.plan_override !== PLANS.FREE
          ? subscription.plan_override
          : subscription
            ? resolvePlan(subscription)
            : PLANS.FREE;
    const planSource = hasActiveAssignment
      ? 'admin'
      : subscription?.plan_override && subscription.plan_override !== PLANS.FREE
        ? 'subscription_override'
        : subscription?.payment_method === 'MANUAL' && plan !== PLANS.FREE
          ? 'manual'
          : subscription?.stripe_subscription_id && plan !== PLANS.FREE
            ? 'stripe'
            : 'free';

    return NextResponse.json(
      {
        subscription,
        plan,
        planSource,
        cancellation,
        isAuthenticated: true,
        isBillingOwner: String(userRow?.role ?? '').toLowerCase() === 'owner',
        barbershopId,
        barbershopName: barbershopResult.data?.name ?? null,
        billingInterval,
        paymentMode,
        manualRequest,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error(
      '[BILLING_SUMMARY_CRITICAL]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Could not load billing summary.' },
      { status: 500 },
    );
  }
}
