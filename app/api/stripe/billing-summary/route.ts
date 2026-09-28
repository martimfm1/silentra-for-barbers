import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { PLANS, planForPrice } from '@/lib/stripe/constants';
import { resolvePlan } from '@/lib/billing/plan-access';
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
            'id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, cancel_at_period_end, current_period_end, trial_end, plan, plan_override, updated_at',
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

    const subscription = subscriptionResult.data as SubscriptionRecord | null;
    const assignment = assignmentResult.data;
    const hasActiveAssignment = Boolean(
      assignment &&
      (!assignment.expires_at ||
        new Date(assignment.expires_at).getTime() > Date.now()),
    );

    let cancellation: {
      canceledAt: string | null;
      canceledByEmail: string | null;
      previousPlan: BillingPlan | null;
    } | null = null;

    if (subscription?.status === 'canceled') {
      let canceledAt = subscription.updated_at ?? null;
      let canceledByEmail = userRow?.email ?? null;
      let previousPlan = planForPrice(subscription.stripe_price_id ?? '');

      if (subscription.stripe_subscription_id) {
        try {
          const remote = await getStripeClient().subscriptions.retrieve(
            subscription.stripe_subscription_id,
          );
          canceledAt = remote.canceled_at
            ? new Date(remote.canceled_at * 1000).toISOString()
            : canceledAt;
          previousPlan =
            planForPrice(remote.items.data[0]?.price.id ?? '') ?? previousPlan;

          const canceledByUserId = remote.metadata?.user_id?.trim();
          if (canceledByUserId) {
            const { data: canceledByUser } = await database
              .from('users')
              .select('email')
              .eq('id', canceledByUserId)
              .maybeSingle();
            canceledByEmail = canceledByUser?.email ?? canceledByEmail;
          }
        } catch (error) {
          console.error(
            '[BILLING_SUMMARY_CANCELLATION_SYNC_ERROR]',
            error instanceof Error ? error.name : 'UNKNOWN',
          );
        }
      }

      cancellation = {
        canceledAt,
        canceledByEmail,
        previousPlan: previousPlan ?? null,
      };
    }

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
