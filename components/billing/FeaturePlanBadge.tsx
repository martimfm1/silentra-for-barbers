'use client';

import { Crown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
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
  const { plan, loading } = useFeatureAccess();
  const minimumPlan = feature
    ? getMinimumPlanForFeature(feature)
    : explicitMinimumPlan;

  if (!minimumPlan || loading) return null;

  // Only show a badge when the current plan does not include the feature.
  // Free users see Pro and Enterprise; Pro users see Enterprise only.
  const alreadyHasRequiredPlan =
    minimumPlan === 'pro' ? plan !== 'free' : plan === 'enterprise';
  if (alreadyHasRequiredPlan) return null;

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
    </span>
  );
}
