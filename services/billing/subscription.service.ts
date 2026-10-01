import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import { planForPrice, PLANS } from '@/lib/stripe/constants';
import { PLAN_ACCESS_STATUSES, resolvePlan } from '@/lib/billing/plan-access';
import {
  BillingError,
  type BillingPlan,
  type SubscriptionRecord,
} from '@/types/stripe';

type SubscriptionRow = Pick<
  SubscriptionRecord,
  | 'user_id'
  | 'stripe_customer_id'
  | 'stripe_subscription_id'
  | 'stripe_price_id'
  | 'plan'
  | 'status'
  | 'trial_end'
  | 'current_period_end'
  | 'cancel_at_period_end'
  | 'payment_method'
> & {
  barbershop_id?: string | null;
};

function subscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

function stripePlanForSubscription(
  subscription: Stripe.Subscription,
): BillingPlan {
  const priceId = subscription.items.data[0]?.price.id;
  return planForPrice(priceId ?? '') ?? PLANS.FREE;
}

function isStripeMissingResource(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'resource_missing'
  );
}

export class SubscriptionService {
  static async getForUser(userId: string): Promise<SubscriptionRecord | null> {
    const { data, error } = await createAdminClient()
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error)
      throw new BillingError('Could not load subscription.', 'DB_READ_FAILED', {
        userId,
      });
    return data as SubscriptionRecord | null;
  }

  static async getForBarbershop(
    barbershopId: string,
  ): Promise<SubscriptionRecord | null> {
    const admin = createAdminClient();
    const { data: owner, error: ownerError } = await admin
      .from('users')
      .select('id')
      .eq('barbershop_id', barbershopId)
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (ownerError)
      throw new BillingError(
        'Could not resolve barbershop owner.',
        'DB_READ_FAILED',
        { barbershopId },
      );
    if (!owner?.id) return null;
    const subscription = await this.getForUser(owner.id);
    if (!subscription) return null;
    return {
      ...subscription,
      barbershop_id: barbershopId,
    } as SubscriptionRecord;
  }

  static async getBarbershopIdForUser(userId: string): Promise<string | null> {
    const { data, error } = await createAdminClient()
      .from('users')
      .select('barbershop_id')
      .eq('id', userId)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not resolve barbershop for user.',
        'DB_READ_FAILED',
        { userId },
      );
    return data?.barbershop_id ?? null;
  }

  static async assertBillingOwner(userId: string): Promise<void> {
    const { data, error } = await createAdminClient()
      .from('users')
      .select('role, barbershop_id')
      .eq('id', userId)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not verify billing owner.',
        'DB_READ_FAILED',
        { userId },
      );
    if (!data?.barbershop_id || data.role !== 'owner')
      throw new BillingError(
        'Apenas o proprietário da barbearia pode gerir a subscrição.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
  }

  static async reconcileStripeSubscription(
    userId: string,
    subscription: SubscriptionRecord | null,
  ): Promise<SubscriptionRecord | null> {
    if (
      subscription?.payment_method === 'MANUAL' ||
      !subscription?.stripe_subscription_id ||
      (subscription.plan_override && subscription.plan_override !== PLANS.FREE)
    )
      return subscription;
    try {
      const stripeSubscription = await getStripeClient().subscriptions.retrieve(
        subscription.stripe_subscription_id,
      );
      const priceId =
        stripeSubscription.items.data[0]?.price.id ??
        subscription.stripe_price_id;
      const stripePlan = stripePlanForSubscription(stripeSubscription);
      const access =
        (PLAN_ACCESS_STATUSES as readonly string[]).includes(
          stripeSubscription.status,
        ) && stripePlan !== PLANS.FREE;
      const nextPlan = access ? stripePlan : PLANS.FREE;
      const periodEnd = subscriptionPeriodEnd(stripeSubscription);
      const updates = {
        plan: nextPlan,
        stripe_customer_id:
          typeof stripeSubscription.customer === 'string'
            ? stripeSubscription.customer
            : stripeSubscription.customer.id,
        stripe_price_id: priceId,
        status: stripeSubscription.status,
        trial_end: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : subscription.current_period_end,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        payment_method: 'STRIPE' as const,
      };
      const changed =
        subscription.plan !== updates.plan ||
        subscription.stripe_customer_id !== updates.stripe_customer_id ||
        subscription.stripe_price_id !== updates.stripe_price_id ||
        subscription.status !== updates.status ||
        subscription.trial_end !== updates.trial_end ||
        subscription.current_period_end !== updates.current_period_end ||
        subscription.cancel_at_period_end !== updates.cancel_at_period_end;
      if (changed) {
        const { error } = await createAdminClient()
          .from('subscriptions')
          .update(updates)
          .eq('id', subscription.id);
        if (error)
          throw new BillingError(
            'Could not reconcile subscription with Stripe.',
            'DB_WRITE_FAILED',
            {
              userId,
              subscriptionId: stripeSubscription.id,
              stripeStatus: stripeSubscription.status,
            },
          );
      }
      return { ...subscription, ...updates } as SubscriptionRecord;
    } catch (error) {
      if (isStripeMissingResource(error)) {
        const { error: updateError } = await createAdminClient()
          .from('subscriptions')
          .update({
            status: 'canceled',
            plan: PLANS.FREE,
            cancel_at_period_end: false,
          })
          .eq('id', subscription.id);
        if (updateError)
          throw new BillingError(
            'Could not reconcile missing Stripe subscription.',
            'DB_WRITE_FAILED',
            { userId, subscriptionId: subscription.stripe_subscription_id },
          );
        return {
          ...subscription,
          status: 'canceled',
          plan: PLANS.FREE,
          cancel_at_period_end: false,
        } as SubscriptionRecord;
      }
      throw error;
    }
  }

  static async getActiveForUser(
    userId: string,
  ): Promise<SubscriptionRecord | null> {
    const subscription = await this.getForUser(userId);
    const reconciled = await this.reconcileStripeSubscription(
      userId,
      subscription,
    );
    if (!reconciled) return null;
    if (reconciled.plan_override && reconciled.plan_override !== PLANS.FREE)
      return reconciled;
    if (reconciled.plan === PLANS.FREE) return null;
    return (PLAN_ACCESS_STATUSES as readonly string[]).includes(
      reconciled.status,
    )
      ? reconciled
      : null;
  }

  static async getActiveForBarbershop(
    barbershopId: string,
  ): Promise<SubscriptionRecord | null> {
    const subscription = await this.getForBarbershop(barbershopId);
    if (!subscription) return null;
    const reconciled = await this.reconcileStripeSubscription(
      subscription.user_id,
      subscription,
    );
    if (!reconciled) return null;
    if (reconciled.plan_override && reconciled.plan_override !== PLANS.FREE)
      return reconciled;
    if (reconciled.plan === PLANS.FREE) return null;
    return (PLAN_ACCESS_STATUSES as readonly string[]).includes(
      reconciled.status,
    )
      ? reconciled
      : null;
  }

  static async getAccessPlanForBarbershop(
    barbershopId: string,
  ): Promise<BillingPlan> {
    const admin = createAdminClient();
    const { data: assignment, error: assignmentError } = await admin
      .from('barbershop_plan_assignments')
      .select('plan, expires_at')
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (assignmentError)
      throw new BillingError(
        'Could not load barbershop plan assignment.',
        'DB_READ_FAILED',
        { barbershopId },
      );
    if (
      assignment &&
      (!assignment.expires_at ||
        new Date(assignment.expires_at).getTime() > Date.now())
    )
      return assignment.plan as BillingPlan;
    const subscription = await this.getForBarbershop(barbershopId);
    if (!subscription) return PLANS.FREE;
    if (subscription.plan_override)
      return subscription.plan_override as BillingPlan;
    const reconciled = await this.reconcileStripeSubscription(
      subscription.user_id,
      subscription,
    );
    return resolvePlan(reconciled ?? subscription);
  }

  static async getAccessPlan(userId: string): Promise<BillingPlan> {
    const barbershopId = await this.getBarbershopIdForUser(userId);

    const current = await this.getForUser(userId);
    if (
      current?.payment_method === 'MANUAL' &&
      current.plan !== PLANS.FREE &&
      ['active', 'trialing'].includes(current.status)
    ) {
      throw new BillingError(
        'A subscrição manual ativa não pode ser migrada automaticamente para Stripe.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    }
    if (!barbershopId) return PLANS.FREE;
    return this.getAccessPlanForBarbershop(barbershopId);
  }

  static async resolveAccessPlanForUser(userId: string): Promise<BillingPlan> {
    return this.getAccessPlan(userId);
  }

  static async findUserIdByCustomerId(
    stripeCustomerId: string,
  ): Promise<string | null> {
    const { data, error } = await createAdminClient()
      .from('customers')
      .select('user_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not resolve Stripe customer.',
        'DB_READ_FAILED',
        { stripeCustomerId },
      );
    return data?.user_id ?? null;
  }

  static async syncFromStripe(
    userId: string,
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    const priceId = subscription.items.data[0]?.price.id;
    const periodEnd = subscriptionPeriodEnd(subscription);
    if (!priceId || !periodEnd)
      throw new BillingError(
        'Stripe subscription is missing a recurring price or period end.',
        'WEBHOOK_PROCESSING_FAILED',
        { subscriptionId: subscription.id },
      );
    const barbershopId = await this.getBarbershopIdForUser(userId);
    const plan = (PLAN_ACCESS_STATUSES as readonly string[]).includes(
      subscription.status,
    )
      ? (planForPrice(priceId) ?? PLANS.FREE)
      : PLANS.FREE;
    const row: SubscriptionRow = {
      user_id: userId,
      barbershop_id: barbershopId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan,
      status: subscription.status,
      payment_method: 'STRIPE',
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    };
    const { error } = await createAdminClient()
      .from('subscriptions')
      .upsert(row, { onConflict: 'user_id' });
    if (error)
      throw new BillingError(
        'Could not persist subscription state.',
        'DB_WRITE_FAILED',
        { userId, subscriptionId: subscription.id, barbershopId },
      );
  }

  static async markCanceled(userId: string): Promise<void> {
    const subscription = await this.getForUser(userId);
    if (
      subscription?.plan_override &&
      subscription.plan_override !== PLANS.FREE
    )
      return;
    const { error } = await createAdminClient()
      .from('subscriptions')
      .update({
        status: 'canceled',
        plan: PLANS.FREE,
        cancel_at_period_end: false,
      })
      .eq('user_id', userId);
    if (error)
      throw new BillingError(
        'Could not mark subscription as canceled.',
        'DB_WRITE_FAILED',
        { userId },
      );
  }

  static async revokePaidAccess(
    userId: string,
    status: SubscriptionRecord['status'],
  ): Promise<void> {
    const subscription = await this.getForUser(userId);
    if (
      subscription?.plan_override &&
      subscription.plan_override !== PLANS.FREE
    )
      return;
    const { error } = await createAdminClient()
      .from('subscriptions')
      .update({ status, plan: PLANS.FREE, cancel_at_period_end: false })
      .eq('user_id', userId);
    if (error)
      throw new BillingError(
        'Could not revoke paid access.',
        'DB_WRITE_FAILED',
        { userId },
      );
  }
}
