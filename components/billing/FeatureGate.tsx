'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { FeatureKey } from '@/lib/billing/plan-features';
import { getMinimumPlanForFeature } from '@/lib/billing/plan-features';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';

export function useFeatureGate() {
  const router = useRouter();
  const { plan, hasFeature } = useFeatureAccess();
  const requestUpgrade = (feature: FeatureKey) => {
    if (hasFeature(feature)) return true;
    const requiredPlan = getMinimumPlanForFeature(feature) ?? 'pro';
    const planLabel = requiredPlan === 'enterprise' ? 'Enterprise' : 'Pro';
    toast(`Esta funcionalidade requer o plano ${planLabel}.`, {
      description: 'Faz upgrade para desbloquear esta funcionalidade.',
      action: { label: 'Ver planos', onClick: () => router.push('/plans') },
    });
    return false;
  };
  return { plan, hasFeature, requestUpgrade };
}

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  mode?: 'hide' | 'disable';
}
export function FeatureGate({
  feature,
  children,
  fallback,
  mode = 'hide',
}: FeatureGateProps) {
  const { hasFeature, requestUpgrade } = useFeatureGate();
  if (hasFeature(feature)) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  if (mode === 'disable')
    return (
      <div className="relative opacity-55 grayscale transition-opacity hover:opacity-75">
        <div className="pointer-events-none">{children}</div>
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          onClick={() => requestUpgrade(feature)}
          aria-label="Desbloquear esta funcionalidade através de um upgrade"
        />
        <span className="pointer-events-none absolute right-3 top-3 z-20">
          <FeaturePlanBadge feature={feature} />
        </span>
      </div>
    );
  return null;
}

export function UpgradeButton({
  feature,
  children = 'Fazer upgrade',
}: {
  feature: FeatureKey;
  children?: ReactNode;
}) {
  const { requestUpgrade } = useFeatureGate();
  return (
    <button type="button" onClick={() => requestUpgrade(feature)}>
      {children}
    </button>
  );
}
