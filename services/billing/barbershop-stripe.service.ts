import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import {
  planForPrice,
  PLANS,
  TRIAL_PERIOD_DAYS,
  type CheckoutInterval,
  type CheckoutPlan,
} from '@/lib/stripe/constants';
import { PLAN_ACCESS_STATUSES, resolvePlan } from '@/lib/billing/plan-access';
import {
  BillingError,
  type BillingPlan,
  type SubscriptionRecord,
} from '@/types/stripe';
import { StripePriceService } from './stripe-price.service';

const PENDING_INVOICE_TTL_MS = 10 * 60 * 1000;
const CHECKOUT_IDEMPOTENCY_BUCKET_MS = 10 * 60 * 1000;

type TenantContext = {
  userId: string;
  email: string;
  role: string;
  barbershopId: string;
};

type BillingAccountRow = {
  barbershop_id: string;
  billing_owner_user_id: string | null;
  stripe_customer_id: string;
  billing_email: string | null;
  trial_started_at: string | null;
};

function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): string {
  return typeof customer === 'string' ? customer : customer.id;
}

function subscriptionMetadata(
  subscription: Stripe.Subscription,
): Record<string, string> {
  const metadata = subscription.metadata ?? {};
  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([, value]) => typeof value === 'string',
    ),
  );
}

function subscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

function subscriptionPlan(subscription: Stripe.Subscription): BillingPlan {
  const priceId = subscription.items.data[0]?.price.id ?? '';
  return planForPrice(priceId) ?? PLANS.FREE;
}

function isMissingStripeResource(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'resource_missing'
  );
}

export class BarbershopStripeService {
  static async getTenantContext(userId: string): Promise<TenantContext> {
    const database = createAdminClient();
    const { data: user, error: userError } = await database
      .from('users')
      .select('id, email, role, barbershop_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError)
      throw new BillingError('Could not load SaaS account.', 'DB_READ_FAILED');
    if (!user?.barbershop_id || !user.email)
      throw new BillingError(
        'A barbershop is required before billing can be managed.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );

    const { data: barbershop, error: barbershopError } = await database
      .from('barbershops')
      .select('id, created_by')
      .eq('id', user.barbershop_id)
      .maybeSingle();

    if (barbershopError)
      throw new BillingError(
        'Could not load barbershop account.',
        'DB_READ_FAILED',
      );
    if (!barbershop || barbershop.created_by !== userId)
      throw new BillingError(
        'Only the barbershop owner can manage the subscription.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );

    return {
      userId,
      email: user.email,
      role: String(user.role ?? ''),
      barbershopId: user.barbershop_id,
    };
  }

  static async getBillingAccount(
    barbershopId: string,
  ): Promise<BillingAccountRow | null> {
    const { data, error } = await createAdminClient()
      .from('barbershop_billing_accounts')
      .select(
        'barbershop_id, billing_owner_user_id, stripe_customer_id, billing_email, trial_started_at',
      )
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    if (error)
      throw new BillingError(
        'Could not load Stripe billing account.',
        'DB_READ_FAILED',
      );
    return (data as BillingAccountRow | null) ?? null;
  }

  static async getOrCreateCustomer(userId: string): Promise<string> {
    const tenant = await this.getTenantContext(userId);
    const database = createAdminClient();
    const existingAccount = await this.getBillingAccount(tenant.barbershopId);

    if (existingAccount?.stripe_customer_id) {
      const customer = await getStripeClient().customers.retrieve(
        existingAccount.stripe_customer_id,
      );
      if (customer.deleted)
        throw new BillingError(
          'The Stripe customer was deleted and needs to be recreated.',
          'CUSTOMER_NOT_FOUND',
        );
      await getStripeClient().customers.update(
        existingAccount.stripe_customer_id,
        {
          email: tenant.email,
          metadata: {
            ...customer.metadata,
            app: 'silentra-for-barbers',
            barbershop_id: tenant.barbershopId,
            billing_owner_user_id: tenant.userId,
          },
        },
      );
      return existingAccount.stripe_customer_id;
    }

    const legacy = await database
      .from('customers')
      .select('stripe_customer_id, email')
      .eq('user_id', tenant.userId)
      .maybeSingle();
    if (legacy.error)
      throw new BillingError(
        'Could not load Stripe customer mapping.',
        'DB_READ_FAILED',
      );

    if (legacy.data?.stripe_customer_id) {
      const stripeCustomer = await getStripeClient().customers.retrieve(
        legacy.data.stripe_customer_id,
      );
      if (!stripeCustomer.deleted) {
        const { error: writeError } = await database
          .from('barbershop_billing_accounts')
          .upsert(
            {
              barbershop_id: tenant.barbershopId,
              billing_owner_user_id: tenant.userId,
              stripe_customer_id: stripeCustomer.id,
              billing_email: tenant.email,
            },
            { onConflict: 'barbershop_id' },
          );
        if (writeError)
          throw new BillingError(
            'Could not link the Stripe customer to the barbershop.',
            'DB_WRITE_FAILED',
          );
        return stripeCustomer.id;
      }
    }

    const customer = await getStripeClient().customers.create(
      {
        email: tenant.email,
        metadata: {
          app: 'silentra-for-barbers',
          barbershop_id: tenant.barbershopId,
          billing_owner_user_id: tenant.userId,
        },
      },
      { idempotencyKey: `barbershop-customer:${tenant.barbershopId}` },
    );

    const { error: writeError } = await database
      .from('barbershop_billing_accounts')
      .upsert(
        {
          barbershop_id: tenant.barbershopId,
          billing_owner_user_id: tenant.userId,
          stripe_customer_id: customer.id,
          billing_email: tenant.email,
        },
        { onConflict: 'barbershop_id' },
      );

    if (writeError)
      throw new BillingError(
        'Could not persist Stripe billing account.',
        'DB_WRITE_FAILED',
      );
    return customer.id;
  }

  static async getSubscriptionForBarbershop(
    barbershopId: string,
  ): Promise<SubscriptionRecord | null> {
    const { data, error } = await createAdminClient()
      .from('subscriptions')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error)
      throw new BillingError(
        'Could not load barbershop subscription.',
        'DB_READ_FAILED',
      );
    return data as SubscriptionRecord | null;
  }

  static async reconcileSubscription(
    barbershopId: string,
    subscription: SubscriptionRecord | null,
  ): Promise<SubscriptionRecord | null> {
    if (
      !subscription?.stripe_subscription_id ||
      (subscription.plan_override && subscription.plan_override !== PLANS.FREE)
    )
      return subscription;

    try {
      const remote = await getStripeClient().subscriptions.retrieve(
        subscription.stripe_subscription_id,
      );
      const priceId =
        remote.items.data[0]?.price.id ?? subscription.stripe_price_id;
      const stripePlan = subscriptionPlan(remote);
      const hasAccess =
        (PLAN_ACCESS_STATUSES as readonly string[]).includes(remote.status) &&
        stripePlan !== PLANS.FREE;
      const nextPlan = hasAccess ? stripePlan : PLANS.FREE;
      const periodEnd = subscriptionPeriodEnd(remote);
      const isCanceled = remote.status === 'canceled';
      const cancellationIsScheduled =
        remote.cancel_at_period_end && !isCanceled;
      const updates = {
        barbershop_id: barbershopId,
        stripe_customer_id: stripeCustomerId(remote.customer),
        stripe_price_id: priceId,
        plan: nextPlan,
        status: remote.status,
        trial_end: remote.trial_end
          ? new Date(remote.trial_end * 1000).toISOString()
          : null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : subscription.current_period_end,
        cancel_at_period_end: remote.cancel_at_period_end,

      };

      const changed =
        subscription.plan !== updates.plan ||
        subscription.status !== updates.status ||
        subscription.stripe_price_id !== updates.stripe_price_id ||
        subscription.stripe_customer_id !== updates.stripe_customer_id ||
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
          );
      }
      return { ...subscription, ...updates } as SubscriptionRecord;
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;
      const { error: updateError } = await createAdminClient()
        .from('subscriptions')
        .update({
          plan: PLANS.FREE,
          status: 'canceled',
          cancel_at_period_end: false,
        })
        .eq('id', subscription.id);
      if (updateError)
        throw new BillingError(
          'Could not reconcile missing Stripe subscription.',
          'DB_WRITE_FAILED',
        );
      return {
        ...subscription,
        plan: PLANS.FREE,
        status: 'canceled',
        cancel_at_period_end: false,
        canceled_at: subscription.canceled_at ?? new Date().toISOString(),
      } as SubscriptionRecord;
    }
  }

  private static async hasRecordedStripeBillingHistory(
    customerId: string,
  ): Promise<boolean> {
    const stripe = getStripeClient();
    const [subscriptions, invoices] = await Promise.all([
      stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1,
      }),
      stripe.invoices.list({
        customer: customerId,
        limit: 1,
      }),
    ]);
    return subscriptions.data.length > 0 || invoices.data.length > 0;
  }

  static async getEffectivePlan(userId: string): Promise<BillingPlan> {
    const database = createAdminClient();
    const tenant = await database
      .from('users')
      .select('barbershop_id')
      .eq('id', userId)
      .maybeSingle();
    if (tenant.error)
      throw new BillingError(
        'Could not resolve SaaS account.',
        'DB_READ_FAILED',
      );
    const barbershopId = tenant.data?.barbershop_id;
    if (!barbershopId) return PLANS.FREE;

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
    if (
      assignment &&
      (!assignment.expires_at ||
        new Date(assignment.expires_at).getTime() > Date.now())
    )
      return assignment.plan as BillingPlan;

    const subscription = await this.reconcileSubscription(
      barbershopId,
      await this.getSubscriptionForBarbershop(barbershopId),
    );
    return resolvePlan(subscription);
  }

  static async createElementsCheckout(
    userId: string,
    plan: CheckoutPlan,
    interval: CheckoutInterval = 'month',
  ): Promise<{ clientSecret: string; sessionId: string }> {
    const tenant = await this.getTenantContext(userId);
    const verifiedPrice = await StripePriceService.resolveVerifiedPrice(
      plan,
      interval,
    );

    const existing = await this.reconcileSubscription(
      tenant.barbershopId,
      await this.getSubscriptionForBarbershop(tenant.barbershopId),
    );
    if (
      existing &&
      existing.plan !== PLANS.FREE &&
      (PLAN_ACCESS_STATUSES as readonly string[]).includes(existing.status)
    )
      throw new BillingError(
        'An active subscription already exists.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );

    const customer = await this.getOrCreateCustomer(userId);
    const canTrial =
      plan === PLANS.PRO &&
      !existing?.stripe_subscription_id &&
      !(await this.hasRecordedStripeBillingHistory(customer));
    let appOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appOrigin) appOrigin = 'https://barbers.silentra.me';
    if (!appOrigin.startsWith('http://') && !appOrigin.startsWith('https://'))
      appOrigin = 'https://' + appOrigin;
    const returnUrl = appOrigin + '/checkout/success?session_id={CHECKOUT_SESSION_ID}';
    const bucket = Math.floor(Date.now() / CHECKOUT_IDEMPOTENCY_BUCKET_MS);

    const session = await getStripeClient().checkout.sessions.create(
      {
        customer,
        mode: 'subscription',
        ui_mode: 'elements',
        line_items: [{ price: verifiedPrice.id, quantity: 1 }],
        return_url: returnUrl,
        client_reference_id: tenant.barbershopId,
        allow_promotion_codes: true,
        metadata: {
          app: 'silentra-for-barbers',
          user_id: tenant.userId,
          barbershop_id: tenant.barbershopId,
          stripe_customer_id: customer,
          plan,
          billing_interval: interval,
          trial_eligible: canTrial ? 'true' : 'false',
        },
        subscription_data: {
          metadata: {
            app: 'silentra-for-barbers',
            user_id: tenant.userId,
            barbershop_id: tenant.barbershopId,
            plan,
            billing_interval: interval,
            trial_eligible: canTrial ? 'true' : 'false',
          },
          ...(canTrial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
        },
        billing_address_collection: 'required',
        customer_update: { name: 'auto', address: 'auto' },
        phone_number_collection: { enabled: true },
        tax_id_collection: { enabled: true },
        locale: 'pt',
      },
      {
        idempotencyKey:
          'checkout-elements:' +
          tenant.barbershopId +
          ':' +
          plan +
          ':' +
          interval +
          ':' +
          bucket,
      },
    );

    if (!session.client_secret)
      throw new BillingError(
        'Stripe did not return a Checkout Elements client secret.',
        'WEBHOOK_PROCESSING_FAILED',
      );
    return { clientSecret: session.client_secret, sessionId: session.id };
  }
  static async createCustomerPortal(
    userId: string,
    requestUrl?: string,
  ): Promise<string> {
    const tenant = await this.getTenantContext(userId);
    const customer = await this.getOrCreateCustomer(userId);
    let origin = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!origin && requestUrl) {
      try {
        origin = new URL(requestUrl).origin;
      } catch {
        /* ignore */
      }
    }
    if (!origin) origin = 'https://barbers.silentra.me';
    if (!origin.startsWith('http://') && !origin.startsWith('https://'))
      origin = `https://${origin}`;
    const returnUrl = `${origin}/dashboard/billing`;
    const configuration =
      process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim();
    const session = await getStripeClient().billingPortal.sessions.create({
      customer,
      return_url: returnUrl,
      ...(configuration ? { configuration } : {}),
    });
    return session.url;
  }

  static async cancelAtPeriodEnd(userId: string): Promise<void> {
    const tenant = await this.getTenantContext(userId);
    const subscription = await this.reconcileSubscription(
      tenant.barbershopId,
      await this.getSubscriptionForBarbershop(tenant.barbershopId),
    );
    if (!subscription?.stripe_subscription_id)
      throw new BillingError(
        'No active paid subscription was found.',
        'SUBSCRIPTION_NOT_FOUND',
      );

    const cancellationRequestedAt = new Date().toISOString();
    const updated = await getStripeClient().subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        metadata: {
          ...subscriptionMetadata(subscription),
          cancellation_requested_by_user_id: userId,
          cancellation_requested_at: cancellationRequestedAt,
        },
      },
    );
    await this.syncFromStripe(
      tenant.barbershopId,
      tenant.userId,
      updated,
    );
  }

  static async resume(userId: string): Promise<void> {
    const tenant = await this.getTenantContext(userId);
    const subscription = await this.reconcileSubscription(
      tenant.barbershopId,
      await this.getSubscriptionForBarbershop(tenant.barbershopId),
    );
    if (!subscription?.stripe_subscription_id)
      throw new BillingError(
        'No active paid subscription was found.',
        'SUBSCRIPTION_NOT_FOUND',
      );
    if (!subscription.cancel_at_period_end)
      return;

    const updated = await getStripeClient().subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: false },
    );

    await this.syncFromStripe(
      tenant.barbershopId,
      tenant.userId,
      updated,
    );
  }

  static async getInvoices(userId: string) {
    const customer = await this.getOrCreateCustomer(userId);
    const invoices = await getStripeClient().invoices.list({
      customer,
      limit: 12,
    });
    const now = Date.now();
    return invoices.data
      .filter((invoice) => {
        const pending =
          invoice.status === null ||
          invoice.status === 'draft' ||
          invoice.status === 'open';
        return (
          !pending || now - invoice.created * 1000 <= PENDING_INVOICE_TTL_MS
        );
      })
      .map((invoice) => ({
        id: invoice.id,
        amount: invoice.amount_paid || invoice.amount_due,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        date: new Date(invoice.created * 1000).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        invoice_pdf: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
      }));
  }

  static async syncFromStripe(
    barbershopId: string,
    ownerUserId: string,
    subscription: Stripe.Subscription,

  ): Promise<void> {
    const customer = stripeCustomerId(subscription.customer);
    const priceId = subscription.items.data[0]?.price.id;
    const periodEnd = subscriptionPeriodEnd(subscription);
    if (!priceId || !periodEnd)
      throw new BillingError(
        'Stripe subscription is missing required billing fields.',
        'WEBHOOK_PROCESSING_FAILED',
      );

    const database = createAdminClient();
    const { data: owner, error: ownerError } = await database
      .from('users')
      .select('id, email, barbershop_id, role')
      .eq('id', ownerUserId)
      .maybeSingle();

    if (ownerError)
      throw new BillingError(
        'Could not resolve billing owner.',
        'DB_READ_FAILED',
      );
    if (
      !owner ||
      owner.barbershop_id !== barbershopId ||
      String(owner.role ?? '').toLowerCase() !== 'owner'
    )
      throw new BillingError(
        'Billing owner does not match the barbershop.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );

    const { data: billingAccount, error: billingAccountError } = await database
      .from('barbershop_billing_accounts')
      .select('stripe_customer_id, billing_owner_user_id')
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    if (billingAccountError)
      throw new BillingError(
        'Could not load Stripe billing account.',
        'DB_READ_FAILED',
      );
    if (
      billingAccount?.billing_owner_user_id &&
      billingAccount.billing_owner_user_id !== ownerUserId
    )
      throw new BillingError(
        'Billing owner mapping does not match.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );
    if (
      billingAccount?.stripe_customer_id &&
      billingAccount.stripe_customer_id !== customer
    )
      throw new BillingError(
        'Stripe customer does not match the barbershop.',
        'SUBSCRIPTION_NOT_ACTIVE',
      );

    const billingEmail = owner.email ?? null;
    const customerWrite = await database.from('customers').upsert(
      {
        user_id: ownerUserId,
        stripe_customer_id: customer,
        email: billingEmail,
      },
      { onConflict: 'user_id' },
    );
    if (customerWrite.error)
      throw new BillingError(
        'Could not persist Stripe customer mapping.',
        'DB_WRITE_FAILED',
      );

    const billingAccountWrite = await database
      .from('barbershop_billing_accounts')
      .upsert(
        {
          barbershop_id: barbershopId,
          billing_owner_user_id: ownerUserId,
          stripe_customer_id: customer,
          billing_email: billingEmail,
          ...(subscription.status === 'trialing'
            ? { trial_started_at: new Date().toISOString() }
            : {}),
        },
        { onConflict: 'barbershop_id' },
      );
    if (billingAccountWrite.error)
      throw new BillingError(
        'Could not persist Stripe billing account.',
        'DB_WRITE_FAILED',
      );

    const plan = (PLAN_ACCESS_STATUSES as readonly string[]).includes(
      subscription.status,
    )
      ? (planForPrice(priceId) ?? PLANS.FREE)
      : PLANS.FREE;

    const existing = await this.getSubscriptionForBarbershop(barbershopId);

    // A plan change can briefly have two Stripe subscriptions for the same
    // customer. Ignore an older subscription's webhook if the database already
    // points at a newer/current subscription so a delayed delete/update event
    // cannot overwrite the new plan.
    if (
      existing?.stripe_subscription_id &&
      existing.stripe_subscription_id !== subscription.id
    ) {
      const currentRemote = await getStripeClient()
        .subscriptions.retrieve(existing.stripe_subscription_id)
        .catch(() => null);

      if (
        currentRemote &&
        (currentRemote.created >= subscription.created ||
          (subscription.status === 'canceled' &&
            (['active', 'trialing'] as string[]).includes(
              currentRemote.status,
            )))
      ) {
        return;
      }
    }

    const payload = {
      user_id: ownerUserId,
      barbershop_id: barbershopId,
      stripe_customer_id: customer,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan,
      status: subscription.status,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    };

    const write = existing
      ? await database
          .from('subscriptions')
          .update(payload)
          .eq('id', existing.id)
      : await database
          .from('subscriptions')
          .upsert(payload, { onConflict: 'barbershop_id' });
    if (write.error)
      throw new BillingError(
        'Could not persist subscription state.',
        'DB_WRITE_FAILED',
      );
  }

  static async findBarbershopByCustomerId(
    customer: string,
  ): Promise<{ barbershopId: string; ownerUserId: string } | null> {
    const database = createAdminClient();
    const { data, error } = await database
      .from('barbershop_billing_accounts')
      .select('barbershop_id, billing_owner_user_id')
      .eq('stripe_customer_id', customer)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not resolve Stripe customer mapping.',
        'DB_READ_FAILED',
      );
    if (data?.barbershop_id && data.billing_owner_user_id) {
      const { data: owner, error: ownerError } = await database
        .from('users')
        .select('id, barbershop_id, role')
        .eq('id', data.billing_owner_user_id)
        .maybeSingle();
      if (ownerError)
        throw new BillingError(
          'Could not resolve billing owner.',
          'DB_READ_FAILED',
        );
      if (
        owner &&
        owner.barbershop_id === data.barbershop_id &&
        String(owner.role ?? '').toLowerCase() === 'owner'
      )
        return {
          barbershopId: data.barbershop_id,
          ownerUserId: data.billing_owner_user_id,
        };
    }

    const legacy = await database
      .from('customers')
      .select('user_id')
      .eq('stripe_customer_id', customer)
      .maybeSingle();
    if (legacy.error)
      throw new BillingError(
        'Could not resolve legacy Stripe customer mapping.',
        'DB_READ_FAILED',
      );
    if (!legacy.data?.user_id) return null;

    const { data: user, error: userError } = await database
      .from('users')
      .select('id, barbershop_id, role')
      .eq('id', legacy.data.user_id)
      .maybeSingle();
    if (userError)
      throw new BillingError(
        'Could not resolve legacy billing user.',
        'DB_READ_FAILED',
      );
    if (
      !user?.barbershop_id ||
      String(user.role ?? '').toLowerCase() !== 'owner'
    )
      return null;
    return { barbershopId: user.barbershop_id, ownerUserId: user.id };
  }

  static async processWebhookEvent(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = stripeCustomerId(subscription.customer);
    const mapping = await this.findBarbershopByCustomerId(customer);
    if (!mapping)
      throw new BillingError(
        'Could not resolve the barbershop for the Stripe subscription.',
        'WEBHOOK_PROCESSING_FAILED',
      );
    await this.syncFromStripe(
      mapping.barbershopId,
      mapping.ownerUserId,
      subscription,
    );
  }
}
