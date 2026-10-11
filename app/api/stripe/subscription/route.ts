import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { BillingError } from '@/types/stripe';
import { billingErrorResponse } from '@/services/billing/http';
import { PaymentModeService } from '@/services/billing/payment-mode.service';
import { assertStripeBillingAvailableForUser } from '@/services/billing/payment-mode.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function GET__unobserved(request: Request) {
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

    await assertStripeBillingAvailableForUser(user.id);

    const checkoutSessionId =
      new URL(request.url).searchParams.get('session_id')?.trim() || null;
    if (checkoutSessionId) {
      const session = await getStripeClient().checkout.sessions.retrieve(
        checkoutSessionId,
        { expand: ['subscription'] },
      );
      // Treat the browser-supplied session ID as an untrusted reference.
      // Bind it to the authenticated user, tenant and persisted Stripe customer
      // before allowing any billing state to be reconciled.
      const sessionUserId =
        session.metadata?.user_id?.trim() ||
        session.metadata?.billing_owner_user_id?.trim() ||
        null;
      const metadataBarbershopId =
        session.metadata?.barbershop_id?.trim() || null;
      const sessionCustomerId =
        typeof session.customer === 'string'
          ? session.customer
          : (session.customer?.id ?? null);
      const referenceId = session.client_reference_id;

      if (
        sessionUserId !== user.id ||
        (metadataBarbershopId && metadataBarbershopId !== barbershopId) ||
        !sessionCustomerId ||
        (referenceId !== barbershopId && referenceId !== user.id)
      ) {
        throw new BillingError(
          'Checkout session does not belong to this account.',
          'SUBSCRIPTION_NOT_ACTIVE',
        );
      }

      const [billingAccountResult, legacyCustomerResult] = await Promise.all([
        database
          .from('barbershop_billing_accounts')
          .select('stripe_customer_id')
          .eq('barbershop_id', barbershopId)
          .maybeSingle(),
        database
          .from('customers')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (billingAccountResult.error || legacyCustomerResult.error) {
        throw new BillingError(
          'Could not verify the Checkout customer mapping.',
          'DB_READ_FAILED',
        );
      }

      // Prefer the canonical tenant mapping. Fall back to the legacy user
      // mapping only when no canonical Stripe customer has been linked yet.
      const expectedCustomerId =
        billingAccountResult.data?.stripe_customer_id ??
        legacyCustomerResult.data?.stripe_customer_id ??
        null;
      if (!expectedCustomerId || expectedCustomerId !== sessionCustomerId) {
        throw new BillingError(
          'Checkout customer does not match this barbershop.',
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

        const stripeSubscriptionCustomerId =
          typeof stripeSubscription.customer === 'string'
            ? stripeSubscription.customer
            : stripeSubscription.customer.id;
        if (stripeSubscriptionCustomerId !== sessionCustomerId) {
          throw new BillingError(
            'Checkout subscription does not match the verified customer.',
            'SUBSCRIPTION_NOT_ACTIVE',
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
            const previousCustomerId =
              typeof previous.customer === 'string'
                ? previous.customer
                : previous.customer.id;
            if (
              previousCustomerId !== sessionCustomerId ||
              (previous.metadata?.barbershop_id &&
                previous.metadata.barbershop_id !== barbershopId) ||
              (previous.metadata?.user_id &&
                previous.metadata.user_id !== user.id)
            ) {
              throw new BillingError(
                'The previous subscription does not belong to this billing account.',
                'SUBSCRIPTION_NOT_ACTIVE',
              );
            }
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

    const paymentMode = await PaymentModeService.getPaymentMode();
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

    const publicSubscription = subscription
      ? { ...subscription, stripe_price_id: null }
      : null;

    return NextResponse.json(
      {
        subscription: publicSubscription,
        plan,
        planSource,
        barbershopId,
        isBillingOwner,
        stripeSubscriptionId: subscription?.stripe_subscription_id ?? null,
        paymentMode,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export const GET = withApiObservability(
  '/api/stripe/subscription',
  GET__unobserved,
);
