import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe/server';
import {
  planForPrice,
  PLANS,
  PRICE_ID_TO_PLAN,
  TRIAL_PERIOD_DAYS,
} from '@/lib/stripe/constants';
import { PLAN_ACCESS_STATUSES } from '@/lib/billing/plan-access';
import {
  BillingError,
  type BillingPlan,
  type SubscriptionRecord,
} from '@/types/stripe';
import { SubscriptionService } from './subscription.service';

const PENDING_INVOICE_TTL_MS = 10 * 60 * 1000;

export interface CreateCheckoutInput {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  promotionCode?: string | null;
}

function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): string {
  return typeof customer === 'string' ? customer : customer.id;
}

export class BillingService {
  static async assertBillingOwner(userId: string): Promise<void> {
    const database = createAdminClient();
    const { data, error } = await database
      .from('users')
      .select('id, role, barbershop_id')
      .eq('id', userId)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not verify billing ownership.',
        'DB_READ_FAILED',
        { userId },
      );
    if (!data?.barbershop_id || String(data.role).toLowerCase() !== 'owner')
      throw new BillingError(
        'Only the barbershop owner can manage billing.',
        'SUBSCRIPTION_NOT_ACTIVE',
        { userId },
      );
    const { data: barbershop, error: barbershopError } = await database
      .from('barbershops')
      .select('id, created_by')
      .eq('id', data.barbershop_id)
      .maybeSingle();
    if (barbershopError)
      throw new BillingError(
        'Could not verify barbershop ownership.',
        'DB_READ_FAILED',
        { userId, barbershopId: data.barbershop_id },
      );
    if (!barbershop || barbershop.created_by !== userId)
      throw new BillingError(
        'Only the barbershop owner can manage billing.',
        'SUBSCRIPTION_NOT_ACTIVE',
        { userId, barbershopId: data.barbershop_id },
      );
  }

  static async getOrCreateCustomer(
    userId: string,
    email: string,
  ): Promise<string> {
    const database = createAdminClient();
    const { data, error } = await database
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not load customer mapping.',
        'DB_READ_FAILED',
        { userId },
      );
    if (data?.stripe_customer_id) return data.stripe_customer_id;
    const customer = await getStripeClient().customers.create(
      { email, metadata: { user_id: userId } },
      { idempotencyKey: `customer:${userId}` },
    );
    const { error: writeError } = await database
      .from('customers')
      .upsert(
        { user_id: userId, stripe_customer_id: customer.id, email },
        { onConflict: 'user_id' },
      );
    if (writeError)
      throw new BillingError(
        'Could not persist customer mapping.',
        'DB_WRITE_FAILED',
        { userId, customerId: customer.id },
      );
    return customer.id;
  }

  static async isEligibleForProTrial(userId: string): Promise<boolean> {
    const { data, error } = await createAdminClient()
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (error)
      throw new BillingError(
        'Could not verify trial eligibility.',
        'DB_READ_FAILED',
        { userId },
      );
    return data.length === 0;
  }

  private static async resolvePromotionCodeId(
    promotionCode?: string | null,
  ): Promise<string | undefined> {
    const normalized = promotionCode?.trim();
    if (!normalized) return undefined;
    if (normalized.length > 100)
      throw new BillingError(
        'O código promocional é demasiado longo.',
        'INVALID_PRICE',
      );
    const promotionCodes = await getStripeClient().promotionCodes.list({
      code: normalized,
      active: true,
      limit: 1,
    });
    const promotion = promotionCodes.data[0];
    if (!promotion)
      throw new BillingError(
        'O código promocional não é válido ou já não está ativo.',
        'INVALID_PRICE',
      );
    return promotion.id;
  }

  static async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<string> {
    const requestedPlan = planForPrice(input.priceId);
    if (!requestedPlan)
      throw new BillingError(
        'The requested price is not available.',
        'INVALID_PRICE',
        { priceId: input.priceId },
      );
    const existing = await SubscriptionService.getActiveForUser(input.userId);
    if (existing)
      throw new BillingError(
        'An active paid subscription already exists; change the plan instead of creating another subscription.',
        'SUBSCRIPTION_NOT_ACTIVE',
        { userId: input.userId },
      );
    const isEligibleForProTrial =
      requestedPlan === PLANS.PRO
        ? await this.isEligibleForProTrial(input.userId)
        : false;
    const promotionCodeId = await this.resolvePromotionCodeId(
      input.promotionCode,
    );
    const stripe = getStripeClient();
    const customer = await this.getOrCreateCustomer(input.userId, input.email);
    const session = await stripe.checkout.sessions.create({
      customer,
      mode: 'subscription',
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.userId,
      metadata: {
        user_id: input.userId,
        offer: isEligibleForProTrial
          ? 'pro_trial'
          : requestedPlan === PLANS.PRO
            ? 'pro_standard'
            : 'standard',
        trial_eligible: isEligibleForProTrial ? 'true' : 'false',
        ...(promotionCodeId ? { promotion_code_id: promotionCodeId } : {}),
      },
      subscription_data: {
        metadata: {
          user_id: input.userId,
          trial_eligible: isEligibleForProTrial ? 'true' : 'false',
          ...(promotionCodeId ? { promotion_code_id: promotionCodeId } : {}),
        },
        ...(isEligibleForProTrial
          ? { trial_period_days: TRIAL_PERIOD_DAYS }
          : {}),
      },
      ...(promotionCodeId
        ? {
            discounts: [{ promotion_code: promotionCodeId }],
            allow_promotion_codes: false,
          }
        : { allow_promotion_codes: true }),
      billing_address_collection: 'required',
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      phone_number_collection: { enabled: true },
      tax_id_collection: { enabled: true },
    });
    if (!session.url)
      throw new BillingError(
        'Stripe did not return a Checkout URL.',
        'WEBHOOK_PROCESSING_FAILED',
      );
    return session.url;
  }

  static async getAvailablePrices() {
    const prices = await Promise.all(
      [...PRICE_ID_TO_PLAN.keys()].map(async (priceId) => {
        const price = await getStripeClient().prices.retrieve(priceId, {
          expand: ['product'],
        });
        return {
          id: price.id,
          plan: planForPrice(price.id),
          name:
            planForPrice(price.id) === PLANS.ENTERPRISE
              ? 'Barbers Enterprise'
              : 'Barbers Pro',
          unitAmount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
        };
      }),
    );
    return prices.filter((price) => price.unitAmount !== null);
  }

  static async cancelAtPeriodEnd(userId: string): Promise<void> {
    await this.updateCancellation(userId, true);
  }
  static async resume(userId: string): Promise<void> {
    await this.updateCancellation(userId, false);
  }
  private static async updateCancellation(
    userId: string,
    cancelAtPeriodEnd: boolean,
  ): Promise<void> {
    const subscription = await SubscriptionService.getActiveForUser(userId);
    if (!subscription?.stripe_subscription_id)
      throw new BillingError(
        'No active paid subscription was found.',
        'SUBSCRIPTION_NOT_FOUND',
        { userId },
      );
    const updated = await getStripeClient().subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: cancelAtPeriodEnd },
    );
    await SubscriptionService.syncFromStripe(userId, updated);
  }

  static async getCustomerId(userId: string): Promise<string> {
    const database = createAdminClient();
    const { data, error } = await database
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error)
      throw new BillingError(
        'Could not load customer mapping.',
        'DB_READ_FAILED',
        { userId },
      );
    if (data?.stripe_customer_id) return data.stripe_customer_id;
    const subscription = await SubscriptionService.getForUser(userId);
    if (!subscription?.stripe_customer_id)
      throw new BillingError(
        'No Stripe customer was found.',
        'CUSTOMER_NOT_FOUND',
        { userId },
      );
    const { error: writeError } = await database.from('customers').upsert(
      {
        user_id: userId,
        stripe_customer_id: subscription.stripe_customer_id,
      },
      { onConflict: 'user_id' },
    );
    if (writeError)
      throw new BillingError(
        'Could not persist customer mapping.',
        'DB_WRITE_FAILED',
        { userId },
      );
    return subscription.stripe_customer_id;
  }

  static async getInvoices(userId: string) {
    const customer = await this.getCustomerId(userId);
    const invoices = await getStripeClient().invoices.list({
      customer,
      limit: 12,
    });
    const now = Date.now();
    return invoices.data
      .filter((invoice) => {
        const isPending =
          invoice.status === null ||
          invoice.status === 'draft' ||
          invoice.status === 'open';
        return (
          !isPending || now - invoice.created * 1000 <= PENDING_INVOICE_TTL_MS
        );
      })
      .map((invoice) => {
        const price = invoice.lines.data.find((line) => line.subscription)
          ?.pricing?.price_details?.price;
        const priceId = typeof price === 'string' ? price : price?.id;
        const plan = priceId ? planForPrice(priceId) : undefined;
        return {
          id: invoice.id,
          amount: invoice.amount_paid || invoice.amount_due,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status,
          plan:
            plan === PLANS.ENTERPRISE
              ? 'Barbers Enterprise'
              : plan === PLANS.PRO
                ? 'Barbers Pro'
                : 'Subscrição',
          date: new Date(invoice.created * 1000).toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          invoice_pdf: invoice.invoice_pdf,
        };
      });
  }

  static async createSetupIntent(
    userId: string,
    email: string,
  ): Promise<string> {
    const customer = await this.getOrCreateCustomer(userId, email);
    const intent = await getStripeClient().setupIntents.create({
      customer,
      usage: 'off_session',
      payment_method_types: ['card'],
    });
    if (!intent.client_secret)
      throw new BillingError(
        'Stripe did not return a Setup Intent secret.',
        'WEBHOOK_PROCESSING_FAILED',
      );
    return intent.client_secret;
  }

  static async createSubscription(
    userId: string,
    email: string,
    priceId: string,
    promotionCode?: string | null,
  ): Promise<{
    subscriptionId: string;
    clientSecret: string | null;
    action: 'created' | 'changed';
  }> {
    const requestedPlan = planForPrice(priceId);
    if (!requestedPlan || requestedPlan === PLANS.FREE)
      throw new BillingError(
        'The requested price is not available.',
        'INVALID_PRICE',
        { priceId },
      );
    const activeSubscription =
      await SubscriptionService.getActiveForUser(userId);
    if (activeSubscription?.stripe_subscription_id) {
      await this.updatePlan(userId, priceId);
      return {
        subscriptionId: activeSubscription.stripe_subscription_id,
        clientSecret: null,
        action: 'changed',
      };
    }
    const existing = await SubscriptionService.getForUser(userId);
    if (existing?.stripe_subscription_id && existing.status === 'incomplete') {
      await getStripeClient().subscriptions.cancel(
        existing.stripe_subscription_id,
      );
      await SubscriptionService.markCanceled(userId);
    }
    const eligibleForProTrial =
      requestedPlan === PLANS.PRO
        ? await this.isEligibleForProTrial(userId)
        : false;
    const promotionCodeId = await this.resolvePromotionCodeId(promotionCode);
    const customer = await this.getOrCreateCustomer(userId, email);
    const subscription = await getStripeClient().subscriptions.create({
      customer,
      items: [{ price: priceId }],
      ...(eligibleForProTrial ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
      payment_behavior: eligibleForProTrial
        ? 'allow_incomplete'
        : 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : {}),
      expand: [
        'latest_invoice.confirmation_secret',
        'latest_invoice.payment_intent',
      ],
      metadata: {
        user_id: userId,
        trial_eligible: eligibleForProTrial ? 'true' : 'false',
        ...(promotionCodeId ? { promotion_code_id: promotionCodeId } : {}),
      },
    });
    const stripe = getStripeClient();
    const invoice =
      typeof subscription.latest_invoice === 'string'
        ? await stripe.invoices.retrieve(subscription.latest_invoice, {
            expand: ['confirmation_secret', 'payment_intent'],
          })
        : subscription.latest_invoice;
    const paymentIntent = (
      invoice as
        | (Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent })
        | null
    )?.payment_intent;
    const paymentIntentSecret =
      typeof paymentIntent === 'string'
        ? undefined
        : paymentIntent?.client_secret;
    const clientSecret =
      invoice?.confirmation_secret?.client_secret ??
      paymentIntentSecret ??
      null;
    if (!eligibleForProTrial && !clientSecret)
      throw new BillingError(
        'Stripe did not return a payment confirmation secret.',
        'WEBHOOK_PROCESSING_FAILED',
      );
    await SubscriptionService.syncFromStripe(userId, subscription);
    return { subscriptionId: subscription.id, clientSecret, action: 'created' };
  }

  static async getPaymentMethods(userId: string) {
    let customer: string;
    try {
      customer = await this.getCustomerId(userId);
    } catch (error) {
      if (error instanceof BillingError && error.code === 'CUSTOMER_NOT_FOUND')
        return [];
      throw error;
    }
    const stripe = getStripeClient();
    const [methods, stripeCustomer] = await Promise.all([
      stripe.paymentMethods.list({ customer, type: 'card' }),
      stripe.customers.retrieve(customer),
    ]);
    const defaultId = stripeCustomer.deleted
      ? undefined
      : typeof stripeCustomer.invoice_settings.default_payment_method ===
          'string'
        ? stripeCustomer.invoice_settings.default_payment_method
        : stripeCustomer.invoice_settings.default_payment_method?.id;
    return methods.data.map((method) => ({
      id: method.id,
      brand: method.card?.brand ?? 'card',
      last4: method.card?.last4 ?? '----',
      expMonth: method.card?.exp_month ?? 0,
      expYear: method.card?.exp_year ?? 0,
      isDefault: method.id === defaultId,
    }));
  }
  static async updatePaymentMethod(
    userId: string,
    action: 'set_default' | 'remove',
    paymentMethodId: string,
  ): Promise<void> {
    const customer = await this.getCustomerId(userId);
    const stripe = getStripeClient();
    const method = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (method.customer !== customer)
      throw new BillingError(
        'Payment method does not belong to this customer.',
        'CUSTOMER_NOT_FOUND',
      );
    if (action === 'set_default') {
      await stripe.customers.update(customer, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      return;
    }
    const stripeCustomer = await stripe.customers.retrieve(customer);
    const defaultId = stripeCustomer.deleted
      ? undefined
      : typeof stripeCustomer.invoice_settings.default_payment_method ===
          'string'
        ? stripeCustomer.invoice_settings.default_payment_method
        : stripeCustomer.invoice_settings.default_payment_method?.id;
    if (defaultId === paymentMethodId)
      await stripe.customers.update(customer, {
        invoice_settings: { default_payment_method: null as unknown as string },
      });
    await stripe.paymentMethods.detach(paymentMethodId);
  }
  static async updatePlan(userId: string, newPriceId: string): Promise<void> {
    const newPlan = planForPrice(newPriceId);
    if (!newPlan || newPlan === PLANS.FREE)
      throw new BillingError(
        'The requested price is not available.',
        'INVALID_PRICE',
        { newPriceId },
      );
    const subscription = await SubscriptionService.getActiveForUser(userId);
    if (!subscription?.stripe_subscription_id)
      throw new BillingError(
        'No active paid subscription was found.',
        'SUBSCRIPTION_NOT_FOUND',
        { userId },
      );
    const current = await getStripeClient().subscriptions.retrieve(
      subscription.stripe_subscription_id,
    );
    if (!(PLAN_ACCESS_STATUSES as readonly string[]).includes(current.status))
      throw new BillingError(
        'No active paid subscription was found.',
        'SUBSCRIPTION_NOT_FOUND',
        { userId, status: current.status },
      );
    const item = current.items.data[0];
    if (!item)
      throw new BillingError(
        'Subscription has no billable item.',
        'SUBSCRIPTION_NOT_FOUND',
      );
    const updated = await getStripeClient().subscriptions.update(current.id, {
      items: [{ id: item.id, price: newPriceId }],
      proration_behavior: 'always_invoice',
    });
    await SubscriptionService.syncFromStripe(userId, updated);
  }
  static async processWebhookEvent(event: Stripe.Event): Promise<void> {
    const stripe = getStripeClient();
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await SubscriptionService.findUserIdByCustomerId(
        customerId(subscription.customer),
      );
      if (!userId)
        throw new BillingError(
          'Webhook customer mapping was not found.',
          'WEBHOOK_PROCESSING_FAILED',
          { eventId: event.id },
        );
      await SubscriptionService.syncFromStripe(userId, subscription);
      return;
    }
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await SubscriptionService.findUserIdByCustomerId(
        customerId(subscription.customer),
      );
      if (userId) await SubscriptionService.markCanceled(userId);
      return;
    }
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerIdValue = invoice.customer;
      if (typeof customerIdValue !== 'string') return;
      const userId =
        await SubscriptionService.findUserIdByCustomerId(customerIdValue);
      if (!userId) return;
      const subscriptionRef = invoice.lines.data.find(
        (line) => line.subscription,
      )?.subscription;
      const subscriptionId =
        typeof subscriptionRef === 'string' ? subscriptionRef : undefined;
      if (subscriptionId)
        await SubscriptionService.syncFromStripe(
          userId,
          await stripe.subscriptions.retrieve(subscriptionId),
        );
      else
        await SubscriptionService.revokePaidAccess(
          userId,
          'past_due' as SubscriptionRecord['status'],
        );
      return;
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.user_id;
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
      if (!userId || !subscriptionId) return;
      await SubscriptionService.syncFromStripe(
        userId,
        await stripe.subscriptions.retrieve(subscriptionId),
      );
    }
  }
}
