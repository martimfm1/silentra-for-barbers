'use client';

import { Crown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  getMinimumPlanForFeature,
  type FeatureKey,
} from '@/lib/billing/plan-features';
import { cn } from '@/lib/utils';

type FeaturePlanBadgeProps = {
  className?: string;
} & (
  | { feature: FeatureKey; minimumPlan?: never }
  | { feature?: never; minimumPlan: 'pro' | 'enterprise' }
);

export function FeaturePlanBadge({
  feature,
  minimumPlan: explicitMinimumPlan,
  className,
}: FeaturePlanBadgeProps) {
  const { locale } = useLanguage();
  const { plan, loading } = useFeatureAccess();
  const minimumPlan = feature
    ? getMinimumPlanForFeature(feature)
    : explicitMinimumPlan;

  if (!minimumPlan || loading) return null;

  // Show the badge only when the current subscription does not include the feature.
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
      role="note"
      title={accessibleLabel}
      aria-label={accessibleLabel}
      data-plan-badge={minimumPlan}
      className={cn(
        'inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-normal normal-case',
        isEnterprise
          ? 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300'
          : 'border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        className,
      )}
    >
      <Crown className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{planLabel}</span>
    </span>
  );
}
