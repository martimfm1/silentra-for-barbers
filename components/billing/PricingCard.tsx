'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Check,
  Sparkles,
  Loader2,
  ArrowRight,
  Shield,
  Gift,
  AlertTriangle,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type PlanTier = 'free' | 'pro' | 'enterprise';
export type PricingDestination = 'plans' | 'checkout';

export interface PricingCardProps {
  tier: PlanTier;
  title: string;
  price: string;
  priceId?: string;
  description: string;
  features: readonly string[];
  popular?: boolean;
  trialDays?: number;
  destination?: PricingDestination;
}

const PLAN_RANK: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 };
const PLAN_NAMES: Record<PlanTier, string> = {
  free: 'Barbers Free',
  pro: 'Barbers Pro',
  enterprise: 'Barbers Enterprise',
};

export function PricingCard({
  tier,
  title,
  price,
  priceId,
  description,
  features,
  popular = false,
  trialDays,
  destination = 'checkout',
}: PricingCardProps) {
  const isMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const {
    isAuthenticated,
    isBillingOwner,
    plan: currentPlan,
    loading,
  } = useSubscription();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const isCurrentPlan = useMemo(
    () => isAuthenticated && currentPlan === tier,
    [currentPlan, isAuthenticated, tier],
  );
  const hasCurrentPaidPlan =
    isAuthenticated && currentPlan !== 'free' && Boolean(currentPlan);
  const isUpgrade =
    isAuthenticated &&
    Boolean(currentPlan) &&
    PLAN_RANK[tier] > PLAN_RANK[currentPlan as PlanTier];
  const isDowngrade =
    isAuthenticated &&
    Boolean(currentPlan) &&
    PLAN_RANK[tier] < PLAN_RANK[currentPlan as PlanTier];
  const isDowngradeToFree =
    isDowngrade && tier === 'free' && hasCurrentPaidPlan;
  const requiresPlanChangeConfirmation = isUpgrade || isDowngrade;

  const handleAction = async () => {
    try {
      if (!isMounted || loading || isChangingPlan) return;
      if (!isAuthenticated) {
        window.location.assign('/registo');
        return;
      }
      if (isCurrentPlan) return;
      if (!isBillingOwner) {
        toast.error(
          'Apenas o proprietário da barbearia pode alterar a subscrição.',
        );
        return;
      }
      if (destination === 'plans') {
        window.location.assign('/plans');
        return;
      }
      if (tier === 'free' && !hasCurrentPaidPlan) {
        window.location.assign('/dashboard/billing');
        return;
      }
      if (requiresPlanChangeConfirmation) {
        setConfirmationOpen(true);
        return;
      }
      if (!priceId) {
        toast.error('Este plano ainda não está disponível para checkout.');
        return;
      }

      window.location.assign(
        `/checkout?priceId=${encodeURIComponent(priceId)}&plan=${tier}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a alteração do plano.',
      );
    }
  };

  const confirmPlanChange = () => {
    if (isDowngradeToFree) {
      toast.error(
        'A mudança para o plano Free não utiliza o checkout Stripe porque não existe uma subscrição paga para iniciar.',
      );
      return;
    }
    if (!priceId) {
      toast.error('Este plano ainda não está disponível para checkout.');
      return;
    }
    setIsChangingPlan(true);
    setConfirmationOpen(false);
    window.location.assign(
      `/checkout?priceId=${encodeURIComponent(priceId)}&plan=${tier}&change=1`,
    );
  };

  const buttonConfig = useMemo(() => {
    if (!isMounted)
      return {
        label: 'A carregar…',
        disabled: true,
        variant: popular ? ('primary' as const) : ('outline' as const),
      };
    if (!isAuthenticated) {
      const label =
        tier === 'free' ? 'Começar gratuitamente' : 'Criar conta para começar';
      return {
        label,
        disabled: false,
        variant: popular ? ('primary' as const) : ('outline' as const),
      };
    }
    if (isCurrentPlan)
      return {
        label: 'Plano atual',
        disabled: true,
        variant: 'secondary' as const,
      };
    if (!isBillingOwner)
      return {
        label: 'Apenas o proprietário',
        disabled: true,
        variant: 'outline' as const,
      };
    if (destination === 'plans')
      return {
        label: 'Mudar para este plano',
        disabled: false,
        variant: popular ? ('primary' as const) : ('outline' as const),
      };
    if (tier === 'free' && hasCurrentPaidPlan)
      return {
        label: 'Mudar para Free',
        disabled: false,
        variant: 'outline' as const,
      };
    if (tier === 'free')
      return {
        label: 'Mudar para este plano',
        disabled: false,
        variant: 'outline' as const,
      };
    if (!priceId)
      return {
        label: 'Indisponível',
        disabled: true,
        variant: 'outline' as const,
      };
    return {
      label: isUpgrade ? 'Fazer upgrade' : 'Mudar para este plano',
      disabled: false,
      variant: popular ? ('primary' as const) : ('outline' as const),
    };
  }, [
    destination,
    hasCurrentPaidPlan,
    isAuthenticated,
    isBillingOwner,
    isCurrentPlan,
    isMounted,
    isUpgrade,
    popular,
    priceId,
    tier,
  ]);

  const isActivePaidPlan =
    isCurrentPlan && (tier === 'pro' || tier === 'enterprise');
  const currentPlanLabel = currentPlan
    ? PLAN_NAMES[currentPlan as PlanTier]
    : 'Plano atual';
  const confirmationTitle = isDowngrade
    ? 'Confirmar mudança para um plano inferior'
    : 'Confirmar upgrade';
  const confirmationDescription = `Depois da confirmação vais para o checkout Stripe para concluir a nova subscrição. A subscrição atual só será cancelada depois de o novo checkout ficar concluído.`;

  return (
    <>
      <div
        className={`glassmorphism relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-6 transition-[border-color,background-color,box-shadow,transform] duration-200 sm:p-7 ${isActivePaidPlan ? 'border-emerald-500/60 bg-zinc-900/95 shadow-[0_20px_70px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30' : popular ? '-translate-y-1 border-emerald-500/40 bg-zinc-900/95 shadow-[0_24px_80px_rgba(16,185,129,0.14)] ring-1 ring-emerald-500/10' : 'border-white/10 bg-zinc-900/70 shadow-[0_18px_60px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 hover:border-white/20'}`}
      >
        {popular && (
          <div
            className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400"
            aria-hidden="true"
          />
        )}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-zinc-50">
                  {title}
                </h3>
                {popular && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                    <Sparkles className="size-3" /> Recomendado
                  </span>
                )}
                {tier === 'pro' && trialDays ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                    <Gift className="size-3" /> 1 mês grátis
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
                {description}
              </p>
            </div>
            {isCurrentPlan && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                <Shield className="size-3" /> Ativo
              </span>
            )}
          </div>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight text-zinc-50">
              {price}
            </span>
            {tier !== 'free' && (
              <span className="text-xs text-zinc-500">/mês</span>
            )}
          </div>
          {tier === 'pro' && trialDays ? (
            <p className="mt-2 text-xs font-semibold text-emerald-300/90">
              1 mês de Pro grátis para novos membros com o código TRIALPRO.
            </p>
          ) : null}
          {tier === 'pro' && !trialDays ? (
            <p className="mt-2 text-xs font-medium text-emerald-300/90">
              Para crescer sem aumentar a complexidade.
            </p>
          ) : null}
          {tier === 'free' && (
            <p className="mt-2 text-xs text-zinc-500">
              Sem cartão. Começa hoje e atualiza quando precisares.
            </p>
          )}
          {tier === 'enterprise' && (
            <p className="mt-2 text-xs text-zinc-500">
              Para equipas e operações com várias localizações.
            </p>
          )}

          <div className="mt-7 space-y-3 border-t border-white/8 pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              Inclui
            </p>
            <ul className="space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <Check className="size-3" />
                  </div>
                  <span className="text-sm leading-5 text-zinc-300">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/8 pt-5">
          <button
            type="button"
            onClick={handleAction}
            disabled={buttonConfig.disabled || loading || isChangingPlan}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-[background-color,border-color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${buttonConfig.variant === 'primary' ? 'bg-emerald-400 text-zinc-950 shadow-[0_8px_24px_rgba(52,211,153,0.18)] hover:bg-emerald-300 hover:shadow-[0_10px_30px_rgba(52,211,153,0.24)]' : buttonConfig.variant === 'secondary' ? 'border border-white/10 bg-white/5 text-zinc-400' : 'border border-white/15 bg-white/[0.04] text-zinc-100 hover:border-white/25 hover:bg-white/[0.08]'}`}
          >
            {loading || isChangingPlan ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span>{buttonConfig.label}</span>
                {!buttonConfig.disabled && <ArrowRight className="size-4" />}
              </>
            )}
          </button>
          {tier === 'pro' && !isCurrentPlan ? (
            <p className="mt-2 text-center text-[11px] text-zinc-600">
              1 mês grátis para novos utilizadores elegíveis com TRIALPRO.
              Depois aplica-se o preço normal.
            </p>
          ) : null}
        </div>
      </div>

      <Dialog
        open={confirmationOpen}
        onOpenChange={(open) => !isChangingPlan && setConfirmationOpen(open)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 text-zinc-50 shadow-2xl sm:p-6">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle>{confirmationTitle}</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-zinc-400">
              {confirmationDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Atual
              </p>
              <p className="mt-1 font-semibold text-zinc-100">
                {currentPlanLabel}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Novo plano
              </p>
              <p className="mt-1 font-semibold text-zinc-100">{title}</p>
            </div>
          </div>
          <DialogFooter className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setConfirmationOpen(false)}
              disabled={isChangingPlan}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmPlanChange}
              disabled={isChangingPlan}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60"
            >
              {isChangingPlan ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isDowngrade ? 'Ir para checkout' : 'Ir para checkout'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
