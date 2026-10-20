import { withApiObservability } from '@/lib/observability/api';
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

const STRIPE_RECONCILIATION_CACHE_TTL_MS = 120_000;
const recentStripeReconciliations = new Map<string, number>();
const inFlightStripeReconciliations = new Map<
  string,
  Promise<SubscriptionRecord | null>
>();

function markStripeReconciliation(cacheKey: string) {
  const now = Date.now();
  const cutoff = now - STRIPE_RECONCILIATION_CACHE_TTL_MS;
  recentStripeReconciliations.set(cacheKey, now);
  for (const [key, timestamp] of recentStripeReconciliations) {
    if (timestamp < cutoff) recentStripeReconciliations.delete(key);
  }
  while (recentStripeReconciliations.size > 500) {
    const oldestKey = recentStripeReconciliations.keys().next().value;
    if (oldestKey === undefined) break;
    recentStripeReconciliations.delete(oldestKey);
  }
}

async function reconcileSubscriptionWithThrottle(
  barbershopId: string,
  subscription: SubscriptionRecord,
): Promise<SubscriptionRecord | null> {
  const cacheKey = `${subscription.id}:${subscription.updated_at || 'unknown'}`;
  const now = Date.now();
  const checkedAt = recentStripeReconciliations.get(cacheKey);
  if (checkedAt !== undefined && now - checkedAt < STRIPE_RECONCILIATION_CACHE_TTL_MS) {
    return subscription;
  }

  const inFlight = inFlightStripeReconciliations.get(cacheKey);
  if (inFlight) return inFlight;

  const work = BarbershopStripeService.reconcileSubscription(
    barbershopId,
    subscription,
    { timeoutMs: 6000 },
  ).then((result) => {
      markStripeReconciliation(cacheKey);
      return result;
    })
    .catch((error: unknown) => {
      // Back off failed reads too, so provider incidents do not turn every
      // dashboard refresh into another slow Stripe request.
      markStripeReconciliation(cacheKey);
      throw error;
    })
    .finally(() => {
      if (inFlightStripeReconciliations.get(cacheKey) === work) {
        inFlightStripeReconciliations.delete(cacheKey);
      }
    });
  inFlightStripeReconciliations.set(cacheKey, work);
  return work;
}

async function GET__unobserved() {
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

    const database = createAdminClient();
    const [paymentMode, userResult] = await Promise.all([
      PaymentModeService.getPaymentMode(),
      database
        .from('users')
        .select('barbershop_id, role, email')
        .eq('id', user.id)
        .maybeSingle(),
    ]);
    const { data: userRow, error: userError } = userResult;
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
            'id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, cancel_at_period_end, current_period_end, trial_end, plan, plan_override, payment_method, canceled_at, canceled_by_user_id, cancellation_requested_at, updated_at',
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

    // Webhooks keep the local subscription row current. Avoid an external Stripe
    // round-trip on every dashboard read; use reconciliation as a bounded fallback
    // for records that have not been updated recently. The checkout/action routes
    // still reconcile synchronously when fresh provider state is required.
    const subscriptionUpdatedAt = subscription?.updated_at
      ? Date.parse(subscription.updated_at)
      : Number.NaN;
    const subscriptionIsFresh =
      Number.isFinite(subscriptionUpdatedAt) &&
      Date.now() - subscriptionUpdatedAt < 120_000;
    if (
      subscription?.stripe_subscription_id &&
      !subscription.plan_override &&
      subscription.status !== 'canceled' &&
      !subscriptionIsFresh
    ) {
      try {
        subscription = await reconcileSubscriptionWithThrottle(
          barbershopId,
          subscription,
        );
      } catch (error) {
        // Billing summary is read-only: serve the persisted snapshot during a
        // temporary provider outage; checkout routes still require live checks.
        console.warn(
          '[BILLING_SUMMARY_RECONCILIATION_SKIPPED]',
          error instanceof Error ? error.name : 'UNKNOWN',
        );
      }
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
        // Cancellation metadata is persisted by billing/webhook flows. Only
        // contact Stripe when the local record lacks this information.
        const needsRemoteCancellation =
          !subscription.canceled_at || !subscription.canceled_by_user_id;
        const remote =
          needsRemoteCancellation && subscription.stripe_subscription_id
            ? await getStripeClient().subscriptions.retrieve(
                subscription.stripe_subscription_id,
                {},
                { timeout: 6000, maxNetworkRetries: 0 },
              )
            : null;

        const canceledAt = subscription.canceled_at ??
          (remote?.canceled_at
            ? new Date(remote.canceled_at * 1000).toISOString()
            : null);
        const previousPlan =
          planForPrice(remote?.items.data[0]?.price.id ?? '') ??
          planForPrice(subscription.stripe_price_id ?? '') ??
          (subscription.plan === PLANS.FREE ? null : subscription.plan);
        const canceledByUserId =
          subscription.canceled_by_user_id ||
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
          requestedAt: subscription.cancellation_requested_at ??
            remote?.metadata?.cancellation_requested_at ??
            null,
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

export const GET = withApiObservability(
  '/api/stripe/billing-summary',
  GET__unobserved,
);
