import { createAdminClient } from '@/lib/supabase/admin';
import { BillingError } from '@/types/stripe';

export const PAYMENT_MODES = ['MANUAL', 'STRIPE'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const DEFAULT_PAYMENT_MODE: PaymentMode = 'MANUAL';

function isPaymentMode(value: unknown): value is PaymentMode {
  return value === 'MANUAL' || value === 'STRIPE';
}

export class PaymentModeService {
  static async getPaymentMode(): Promise<PaymentMode> {
    const { data, error } = await createAdminClient()
      .from('platform_settings')
      .select('value')
      .eq('key', 'payment_mode')
      .maybeSingle();

    if (error) {
      console.error('[PAYMENT_MODE_READ_ERROR]', error.code ?? 'UNKNOWN');
      return DEFAULT_PAYMENT_MODE;
    }

    return isPaymentMode(data?.value) ? data.value : DEFAULT_PAYMENT_MODE;
  }

  static async setPaymentMode(
    mode: PaymentMode,
    actorUserId: string,
  ): Promise<PaymentMode> {
    if (!isPaymentMode(mode)) {
      throw new Error('Invalid payment mode.');
    }

    const { error } = await createAdminClient()
      .from('platform_settings')
      .upsert(
        {
          key: 'payment_mode',
          value: mode,
          updated_by: actorUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );

    if (error) throw error;

    return mode;
  }
}

export async function assertStripeNewSubscriptionsEnabled(): Promise<void> {
  const mode = await PaymentModeService.getPaymentMode();
  if (mode !== 'STRIPE') {
    throw new BillingError(
      'Os pagamentos Stripe estão atualmente desativados.',
      'PAYMENT_MODE_STRIPE_DISABLED',
    );
  }
}

export async function assertManualPaymentsEnabled(): Promise<void> {
  const mode = await PaymentModeService.getPaymentMode();
  if (mode !== 'MANUAL') {
    throw new BillingError(
      'Os pagamentos manuais estão atualmente desativados.',
      'PAYMENT_MODE_MANUAL_DISABLED',
    );
  }
}

export async function assertStripeBillingAvailableForUser(
  userId: string,
): Promise<void> {
  const mode = await PaymentModeService.getPaymentMode();
  const { data, error } = await createAdminClient()
    .from('subscriptions')
    .select('payment_method, stripe_subscription_id, plan, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new BillingError(
      'Não foi possível verificar o método de faturação.',
      'DB_READ_FAILED',
    );
  }

  if (
    data?.payment_method === 'MANUAL' &&
    data.plan !== 'free' &&
    ['active', 'trialing'].includes(data.status)
  ) {
    throw new BillingError(
      'Esta subscrição é gerida manualmente e não pode ser migrada para a Stripe.',
      'PAYMENT_MODE_STRIPE_DISABLED',
    );
  }

  if (data?.payment_method === 'STRIPE' && data.stripe_subscription_id)
    return;

  if (mode === 'STRIPE') return;

  throw new BillingError(
    'Os pagamentos Stripe estão atualmente desativados.',
    'PAYMENT_MODE_STRIPE_DISABLED',
  );
}

export async function assertUserHasStripeSubscription(
  userId: string,
): Promise<void> {
  const { data, error } = await createAdminClient()
    .from('subscriptions')
    .select('payment_method, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new BillingError(
      'Não foi possível verificar a subscrição Stripe.',
      'DB_READ_FAILED',
    );
  }

  if (data?.payment_method !== 'STRIPE' || !data.stripe_subscription_id) {
    throw new BillingError(
      'Esta subscrição não é gerida pela Stripe.',
      'PAYMENT_MODE_STRIPE_DISABLED',
    );
  }
}
