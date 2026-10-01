import { createAdminClient } from '@/lib/supabase/admin';

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
