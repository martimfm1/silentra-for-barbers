import type Stripe from 'stripe';

export type BillingPlan = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = Stripe.Subscription.Status;

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  barbershop_id: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: BillingPlan;
  /** Optional support/admin override managed directly in Supabase. */
  plan_override: BillingPlan | null;
  status: SubscriptionStatus;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  canceled_by_user_id: string | null;
  cancellation_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerRecord {
  user_id: string;
  stripe_customer_id: string;
  email: string | null;
}

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: BillingErrorCode,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

export type BillingErrorCode =
  | 'BILLING_NOT_CONFIGURED'
  | 'INVALID_PRICE'
  | 'CUSTOMER_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_ACTIVE'
  | 'PROMOTION_NOT_ELIGIBLE'
  | 'CHECKOUT_RESOURCE_MISSING'
  | 'CHECKOUT_FAILED'
  | 'DB_READ_FAILED'
  | 'DB_WRITE_FAILED'
  | 'WEBHOOK_VERIFICATION_FAILED'
  | 'WEBHOOK_PROCESSING_FAILED';
