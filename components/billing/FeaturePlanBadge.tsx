'use client';

import { Crown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import {
  getMinimumPlanForFeature,
  type FeatureKey,
} from '@/lib/billing/plan-features';

type FeaturePlanBadgeProps = {
  detail?: string;
  className?: string;
} & (
  | { feature: FeatureKey; minimumPlan?: never }
  | { feature?: never; minimumPlan: 'pro' | 'enterprise' }
);

export function FeaturePlanBadge({
  feature,
  minimumPlan: explicitMinimumPlan,
  detail,
  className = '',
}: FeaturePlanBadgeProps) {
  const { locale } = useLanguage();
  const minimumPlan = feature
    ? getMinimumPlanForFeature(feature)
    : explicitMinimumPlan;

  if (!minimumPlan) return null;

  const isEnterprise = minimumPlan === 'enterprise';
  const planLabel = isEnterprise ? 'Enterprise' : 'Pro';
  const accessibleLabel =
    locale === 'en'
      ? `${planLabel} plan required`
      : `Requer o plano ${planLabel}`;

  return (
    <span
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className={`inline-flex min-h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${isEnterprise ? 'border-violet-400/25 bg-violet-400/10 text-violet-200' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'} ${className}`}
    >
      <Crown className="size-3" aria-hidden="true" />
      <span>{isEnterprise ? 'Enterprise' : 'Pro'}</span>
      {detail ? <span className="font-medium normal-case tracking-normal">· {detail}</span> : null}
    </span>
  );
}
