import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { BillingError } from '@/types/stripe';
import { billingErrorResponse } from '@/services/billing/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
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
    if (userError)
      throw new BillingError(
        'Could not resolve SaaS account.',
        'DB_READ_FAILED',
      );

    const barbershopId = userRow?.barbershop_id ?? null;
    const isBillingOwner =
      String(userRow?.role ?? '').toLowerCase() === 'owner';
    const email = String(userRow?.email ?? user.email ?? '')
      .trim()
      .toLowerCase();
    if (!barbershopId) {
      return NextResponse.json(
        {
          subscription: null,
          plan: 'free',
          planSource: 'free',
          barbershopId: null,
          isBillingOwner,
          stripeSubscriptionId: null,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const checkoutSessionId =
      new URL(request.url).searchParams.get('session_id')?.trim() || null;
    if (checkoutSessionId) {
      const session = await getStripeClient().checkout.sessions.retrieve(
        checkoutSessionId,
        { expand: ['subscription'] },
      );
      const metadataBarbershopId =
        session.metadata?.barbershop_id ?? session.client_reference_id ?? null;
      if (metadataBarbershopId && metadataBarbershopId !== barbershopId) {
        throw new BillingError(
          'Checkout session does not belong to this barbershop.',
          'SUBSCRIPTION_NOT_ACTIVE',
        );
      }

      const complete = session.status === 'complete';
      const paid =
        session.payment_status === 'paid' ||
        session.payment_status === 'no_payment_required';
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

      if (complete && paid && subscriptionId) {
        const stripeSubscription =
          typeof session.subscription === 'string'
            ? await getStripeClient().subscriptions.retrieve(
                session.subscription,
              )
            : session.subscription;

        if (!stripeSubscription) {
          throw new BillingError(
            'Stripe returned a checkout session without a valid subscription.',
            'WEBHOOK_PROCESSING_FAILED',
          );
        }

        const previousSubscriptionId =
          session.metadata?.previous_subscription_id;
        const isPlanChange = session.metadata?.is_plan_change === 'true';

        await BarbershopStripeService.syncFromStripe(
          barbershopId,
          user.id,
          stripeSubscription,
        );

        if (
          isPlanChange &&
          previousSubscriptionId &&
          previousSubscriptionId !== 'none' &&
          previousSubscriptionId !== stripeSubscription.id
        ) {
          try {
            const previous = await getStripeClient().subscriptions.retrieve(
              previousSubscriptionId,
            );
            const cancellableStatuses = [
              'active',
              'trialing',
              'past_due',
              'unpaid',
              'incomplete',
            ];
            if (cancellableStatuses.includes(previous.status)) {
              await getStripeClient().subscriptions.cancel(previous.id);
            }
          } catch (cancelError) {
            const isMissing =
              typeof cancelError === 'object' &&
              cancelError !== null &&
              'code' in cancelError &&
              (cancelError as { code?: unknown }).code === 'resource_missing';
            if (!isMissing)
              throw new BillingError(
                'A nova subscrição foi criada, mas não foi possível cancelar a subscrição anterior.',
                'WEBHOOK_PROCESSING_FAILED',
              );
          }
        }
      }
    }

    let subscription = await BarbershopStripeService.reconcileSubscription(
      barbershopId,
      await BarbershopStripeService.getSubscriptionForBarbershop(barbershopId),
    );

    if (!subscription) {
      const account =
        await BarbershopStripeService.getBillingAccount(barbershopId);
      if (account?.stripe_customer_id) {
        const subscriptions = await getStripeClient().subscriptions.list({
          customer: account.stripe_customer_id,
          status: 'all',
          limit: 20,
        });
        const latest = [...subscriptions.data]
          .sort((a, b) => b.created - a.created)
          .find((item) =>
            [
              'active',
              'trialing',
              'past_due',
              'unpaid',
              'incomplete',
              'canceled',
            ].includes(item.status),
          );
        if (latest) {
          await BarbershopStripeService.syncFromStripe(
            barbershopId,
            account.billing_owner_user_id ?? user.id,
            latest,
          );
          subscription = await BarbershopStripeService.reconcileSubscription(
            barbershopId,
            await BarbershopStripeService.getSubscriptionForBarbershop(
              barbershopId,
            ),
          );
        }
      } else {
        const customers = await getStripeClient().customers.list({
          email,
          limit: 20,
        });
        const matchingCustomer = customers.data.find(
          (customer) =>
            !customer.deleted &&
            (customer.metadata?.barbershop_id === barbershopId ||
              customer.metadata?.billing_owner_user_id === user.id ||
              customer.metadata?.user_id === user.id),
        );
        if (matchingCustomer) {
          const { error } = await database
            .from('barbershop_billing_accounts')
            .upsert(
              {
                barbershop_id: barbershopId,
                billing_owner_user_id: user.id,
                stripe_customer_id: matchingCustomer.id,
                billing_email: email,
              },
              { onConflict: 'barbershop_id' },
            );
          if (error)
            throw new BillingError(
              'Could not recover the Stripe billing account.',
              'DB_WRITE_FAILED',
            );
        }
      }
    }

    const plan = await BarbershopStripeService.getEffectivePlan(user.id);
    const { data: assignment, error: assignmentError } = await database
      .from('barbershop_plan_assignments')
      .select('plan, expires_at')
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (assignmentError)
      throw new BillingError(
        'Could not load barbershop plan assignment.',
        'DB_READ_FAILED',
      );

    const hasActiveAssignment = Boolean(
      assignment &&
      (!assignment.expires_at ||
        new Date(assignment.expires_at).getTime() > Date.now()),
    );
    const planSource = hasActiveAssignment
      ? 'admin'
      : subscription?.plan_override
        ? 'subscription_override'
        : plan !== 'free'
          ? 'stripe'
          : 'free';

    return NextResponse.json(
      {
        subscription,
        plan,
        planSource,
        barbershopId,
        isBillingOwner,
        stripeSubscriptionId: subscription?.stripe_subscription_id ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}
