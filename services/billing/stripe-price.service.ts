import type Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe/server';
import {
  configuredPriceIdFor,
  planForPrice,
  PLANS,
  type CheckoutInterval,
  type CheckoutPlan,
} from '@/lib/stripe/constants';
import { BillingError } from '@/types/stripe';

function productMetadata(
  product: string | Stripe.Product | Stripe.DeletedProduct,
): Record<string, string> {
  if (typeof product === 'string' || product.deleted) return {};
  return product.metadata ?? {};
}

export class StripePriceService {
  static async resolveVerifiedPrice(
    plan: CheckoutPlan,
    interval: CheckoutInterval = 'month',
  ): Promise<Stripe.Price> {
    const configuredPriceId = configuredPriceIdFor(plan, interval);
    if (!configuredPriceId) {
      throw new BillingError(
        'O plano selecionado não está configurado para este período de faturação.',
        'INVALID_PRICE',
      );
    }

    let price: Stripe.Price;
    try {
      price = await getStripeClient().prices.retrieve(configuredPriceId, {
        expand: ['product'],
      });
    } catch (error) {
      console.error('[STRIPE_PRICE_RESOLVE_ERROR]', {
        code:
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : 'unknown',
      });
      throw new BillingError(
        'O plano selecionado não está disponível neste momento.',
        'INVALID_PRICE',
      );
    }

    if (price.id !== configuredPriceId) {
      throw new BillingError(
        'A configuração do preço não corresponde ao preço autorizado.',
        'INVALID_PRICE',
      );
    }

    if (
      !price.active ||
      price.type !== 'recurring' ||
      !price.recurring ||
      price.recurring.interval !== interval ||
      price.unit_amount === null ||
      price.unit_amount < 0
    ) {
      throw new BillingError(
        'O preço configurado para este plano não está disponível.',
        'INVALID_PRICE',
      );
    }

    if (price.currency.toLowerCase() !== 'eur') {
      throw new BillingError(
        'O preço configurado para este plano usa uma moeda não suportada.',
        'INVALID_PRICE',
      );
    }

    const mappedPlan = planForPrice(price.id);
    if (mappedPlan !== plan) {
      throw new BillingError(
        'O preço Stripe não corresponde ao plano solicitado.',
        'INVALID_PRICE',
      );
    }

    const metadata = productMetadata(price.product);
    const metadataPlan = metadata.plan?.trim().toLowerCase();
    if (
      metadataPlan &&
      metadataPlan !== plan &&
      metadataPlan !== 'barbers_' + plan
    ) {
      throw new BillingError(
        'O produto Stripe não corresponde ao plano solicitado.',
        'INVALID_PRICE',
      );
    }

    return price;
  }

  static async getAvailablePrices(): Promise<
    Array<{
      plan: CheckoutPlan;
      interval: CheckoutInterval;
      unitAmount: number;
      currency: string;
    }>
  > {
    const output: Array<{
      plan: CheckoutPlan;
      interval: CheckoutInterval;
      unitAmount: number;
      currency: string;
    }> = [];

    for (const plan of [PLANS.PRO, PLANS.ENTERPRISE] as const) {
      for (const interval of ['month', 'year'] as const) {
        try {
          const price = await this.resolveVerifiedPrice(plan, interval);
          output.push({
            plan,
            interval,
            unitAmount: price.unit_amount ?? 0,
            currency: price.currency.toUpperCase(),
          });
        } catch {
          // Unconfigured or invalid prices are omitted from the public list.
        }
      }
    }

    return output;
  }
}
