import type { BillingPlan } from '@/types/stripe';

export type ManualBillingInterval = 'month' | 'year';

type ManualPrice = {
  plan: Exclude<BillingPlan, 'free'>;
  interval: ManualBillingInterval;
  unitAmount: number;
  currency: 'EUR';
};

const ENV_PRICE_KEYS = {
  pro: {
    month: 'MANUAL_PRICE_PRO_MONTHLY_EUR',
    year: 'MANUAL_PRICE_PRO_YEARLY_EUR',
  },
  enterprise: {
    month: 'MANUAL_PRICE_ENTERPRISE_MONTHLY_EUR',
    year: 'MANUAL_PRICE_ENTERPRISE_YEARLY_EUR',
  },
} as const;

const DEFAULT_MANUAL_PRICES: Partial<
  Record<'pro' | 'enterprise', Partial<Record<ManualBillingInterval, number>>>
> = {
  pro: { month: 9.9 },
  enterprise: { month: 29.9 },
};

function resolveEnvironmentPrice(
  plan: 'pro' | 'enterprise',
  interval: ManualBillingInterval,
): number | null {
  const key =
    ENV_PRICE_KEYS[plan][
      interval as keyof (typeof ENV_PRICE_KEYS)[typeof plan]
    ];
  const raw = process.env[key];
  if (!raw?.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function getManualPrice(
  plan: 'pro' | 'enterprise',
  interval: ManualBillingInterval = 'month',
): ManualPrice | null {
  const configured = resolveEnvironmentPrice(plan, interval);
  const fallback = DEFAULT_MANUAL_PRICES[plan]?.[interval];
  const unitAmount = configured ?? fallback ?? null;
  if (unitAmount === null) return null;

  return {
    plan,
    interval,
    unitAmount,
    currency: 'EUR',
  };
}

export function getManualPrices(): ManualPrice[] {
  const result: ManualPrice[] = [];
  for (const plan of ['pro', 'enterprise'] as const) {
    for (const interval of ['month', 'year'] as const) {
      const price = getManualPrice(plan, interval);
      if (price) result.push(price);
    }
  }
  return result;
}

export function formatManualPrice(
  plan: 'pro' | 'enterprise',
  interval: ManualBillingInterval = 'month',
): string {
  const price = getManualPrice(plan, interval);
  if (!price) return 'Indisponível';
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: 2,
  }).format(price.unitAmount);
}
