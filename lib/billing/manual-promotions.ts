import {
  getManualPrice,
  type ManualBillingInterval,
} from '@/lib/billing/manual-pricing';
import { BillingError } from '@/types/stripe';
import {
  NEW_MEMBER_PRO_OFFER_MONTHS,
  NEW_MEMBER_PRO_PROMOTION_CODE,
} from '@/lib/stripe/constants';

export type ManualPromotionPlan = 'pro' | 'enterprise';

export type ManualPricingQuote = {
  promotionCode: string | null;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  currency: 'EUR';
  discountDescription: string | null;
  freeTrial: boolean;
};

type PromotionConfig = {
  type: 'percentage' | 'fixed' | 'free_month';
  value?: number;
  plans?: ManualPromotionPlan[];
  intervals?: ManualBillingInterval[];
};

const PLAN_VALUES = new Set<ManualPromotionPlan>(['pro', 'enterprise']);
const INTERVAL_VALUES = new Set<ManualBillingInterval>(['month', 'year']);
const CODE_PATTERN = /^[A-Z0-9_-]{2,40}$/;

function invalidPromotion(): never {
  throw new BillingError(
    'O código promocional não é válido ou não se aplica a este plano.',
    'INVALID_PRICE',
  );
}

function configurationError(): never {
  throw new BillingError(
    'A configuração dos códigos promocionais está indisponível. Tenta novamente mais tarde.',
    'BILLING_NOT_CONFIGURED',
  );
}

function parsePromotions(): Map<string, PromotionConfig> {
  const raw = process.env.MANUAL_PROMO_CODES_JSON?.trim();
  if (!raw) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    configurationError();
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    configurationError();
  }

  const promotions = new Map<string, PromotionConfig>();
  for (const [rawCode, rawConfig] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    const code = rawCode.trim().toUpperCase();
    if (
      !CODE_PATTERN.test(code) ||
      !rawConfig ||
      typeof rawConfig !== 'object' ||
      Array.isArray(rawConfig)
    ) {
      configurationError();
    }

    const config = rawConfig as Record<string, unknown>;
    const type = config.type;
    const value = config.value;
    if (type !== 'percentage' && type !== 'fixed' && type !== 'free_month') {
      configurationError();
    }

    if (type === 'free_month') {
      if (
        code !== NEW_MEMBER_PRO_PROMOTION_CODE ||
        value !== undefined ||
        !Array.isArray(config.plans) ||
        config.plans.length !== 1 ||
        config.plans[0] !== 'pro' ||
        !Array.isArray(config.intervals) ||
        config.intervals.length !== 1 ||
        config.intervals[0] !== 'month'
      ) {
        configurationError();
      }
    } else if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      (type === 'percentage' && value >= 100) ||
      (type === 'fixed' && value > 10000)
    ) {
      configurationError();
    }

    let plans: ManualPromotionPlan[] | undefined;
    if (config.plans !== undefined) {
      if (
        !Array.isArray(config.plans) ||
        config.plans.length === 0 ||
        !config.plans.every(
          (plan): plan is ManualPromotionPlan =>
            typeof plan === 'string' &&
            PLAN_VALUES.has(plan as ManualPromotionPlan),
        )
      ) {
        configurationError();
      }
      plans = config.plans as ManualPromotionPlan[];
    }

    let intervals: ManualBillingInterval[] | undefined;
    if (config.intervals !== undefined) {
      if (
        !Array.isArray(config.intervals) ||
        config.intervals.length === 0 ||
        !config.intervals.every(
          (interval): interval is ManualBillingInterval =>
            typeof interval === 'string' &&
            INTERVAL_VALUES.has(interval as ManualBillingInterval),
        )
      ) {
        configurationError();
      }
      intervals = config.intervals as ManualBillingInterval[];
    }

    if (promotions.has(code)) configurationError();
    const normalizedValue =
      type === 'free_month' ? undefined : (value as number);
    promotions.set(code, {
      type,
      ...(normalizedValue === undefined ? {} : { value: normalizedValue }),
      ...(plans ? { plans } : {}),
      ...(intervals ? { intervals } : {}),
    });
  }

  return promotions;
}

function euroAmount(cents: number): number {
  return Number((Math.max(0, cents) / 100).toFixed(2));
}

/**
 * Resolves the checkout amount using server-controlled prices and promotion
 * configuration. Never accept a discount or final price supplied by a client.
 */
export function quoteManualPrice(
  plan: ManualPromotionPlan,
  interval: ManualBillingInterval,
  promotionCode?: string | null,
  options: { newMemberEligible?: boolean } = {},
): ManualPricingQuote {
  const configuredPrice = getManualPrice(plan, interval);
  if (!configuredPrice) {
    throw new BillingError(
      'Este plano não está configurado para o período de faturação selecionado.',
      'INVALID_PRICE',
    );
  }

  const originalCents = Math.round(configuredPrice.unitAmount * 100);
  const normalizedCode = promotionCode?.trim().toUpperCase() ?? '';
  if (!normalizedCode) {
    return {
      promotionCode: null,
      originalPrice: euroAmount(originalCents),
      discountAmount: 0,
      finalPrice: euroAmount(originalCents),
      currency: 'EUR',
      discountDescription: null,
      freeTrial: false,
    };
  }

  if (!CODE_PATTERN.test(normalizedCode)) invalidPromotion();

  const promotion = parsePromotions().get(normalizedCode);
  if (
    !promotion ||
    (promotion.plans && !promotion.plans.includes(plan)) ||
    (promotion.intervals && !promotion.intervals.includes(interval))
  ) {
    invalidPromotion();
  }

  if (promotion.type === 'free_month') {
    if (plan !== 'pro' || interval !== 'month') invalidPromotion();
    if (!options.newMemberEligible) {
      throw new BillingError(
        `O código ${NEW_MEMBER_PRO_PROMOTION_CODE} é exclusivo para novos clientes elegíveis do plano Pro mensal.`,
        'PROMOTION_NOT_ELIGIBLE',
      );
    }

    return {
      promotionCode: normalizedCode,
      originalPrice: euroAmount(originalCents),
      discountAmount: euroAmount(originalCents),
      finalPrice: 0,
      currency: 'EUR',
      discountDescription: `${NEW_MEMBER_PRO_OFFER_MONTHS} mês grátis`,
      freeTrial: true,
    };
  }

  const requestedDiscountCents =
    promotion.type === 'percentage'
      ? Math.round((originalCents * promotion.value!) / 100)
      : Math.round(promotion.value! * 100);
  const discountCents = Math.min(originalCents, requestedDiscountCents);
  if (discountCents <= 0 || discountCents >= originalCents) {
    invalidPromotion();
  }
  const discountAmount = euroAmount(discountCents);
  const discountDescription =
    promotion.type === 'percentage'
      ? `${promotion.value}% de desconto`
      : `${new Intl.NumberFormat('pt-PT', {
          style: 'currency',
          currency: 'EUR',
        }).format(discountAmount)} de desconto`;

  return {
    promotionCode: normalizedCode,
    originalPrice: euroAmount(originalCents),
    discountAmount,
    finalPrice: euroAmount(originalCents - discountCents),
    currency: 'EUR',
    discountDescription,
    freeTrial: false,
  };
}
