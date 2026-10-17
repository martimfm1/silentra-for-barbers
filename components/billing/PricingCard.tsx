'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
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
import { useCheckout } from '@/hooks/useCheckout';
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
  description: string;
  features: readonly string[];
  popular?: boolean;
  trialDays?: number;
  destination?: PricingDestination;
  billingInterval?: 'month' | 'year';
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
  description,
  features,
  popular = false,
  trialDays,
  destination = 'checkout',
  billingInterval = 'month',
}: PricingCardProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const english = locale === 'en';
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
  const { checkout: beginCheckout, loading: checkoutLoading } = useCheckout();
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
        router.push('/registo');
        return;
      }
      if (isCurrentPlan) return;
      if (!isBillingOwner) {
        toast.error(
          english ? 'Only the barbershop owner can change the subscription.' : 'Apenas o proprietário da barbearia pode alterar a subscrição.',
        );
        return;
      }
      if (destination === 'plans') {
        router.push('/plans');
        return;
      }
      if (tier === 'free' && !hasCurrentPaidPlan) {
        router.push('/dashboard/billing');
        return;
      }
      if (requiresPlanChangeConfirmation) {
        setConfirmationOpen(true);
        return;
      }
      if (tier === 'free') return;

      await beginCheckout({
        plan: tier,
        interval: billingInterval,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : english ? 'Could not complete the plan change.' : 'Não foi possível concluir a alteração do plano.',
      );
    }
  };

  const confirmPlanChange = async () => {
    if (isDowngradeToFree) {
      toast.error(
        english ? 'Switching to Free does not use checkout because there is no paid subscription to change.' : 'A mudança para o plano Free não utiliza o checkout porque não existe uma subscrição paga para iniciar.',
      );
      return;
    }
    setIsChangingPlan(true);
    setConfirmationOpen(false);
    try {
      await beginCheckout({
        plan: tier as 'pro' | 'enterprise',
        interval: billingInterval,
      });
    } catch (error) {
      setIsChangingPlan(false);
      toast.error(
        error instanceof Error
          ? error.message
          : english ? 'Could not start the subscription change.' : 'Não foi possível iniciar a alteração da subscrição.',
      );
    }
  };

  const buttonConfig = useMemo(() => {
    if (!isMounted)
      return {
        label: english ? 'Loading…' : 'A carregar…',
        disabled: true,
        variant: popular ? ('primary' as const) : ('outline' as const),
      };
    if (!isAuthenticated) {
      const label =
        tier === 'free' ? (english ? 'Start for free' : 'Começar gratuitamente') : (english ? 'Create an account to get started' : 'Criar conta para começar');
      return {
        label,
        disabled: false,
        variant: popular ? ('primary' as const) : ('outline' as const),
      };
    }
    if (isCurrentPlan)
      return {
        label: english ? 'Current plan' : 'Plano atual',
        disabled: true,
        variant: 'secondary' as const,
      };
    if (!isBillingOwner)
      return {
        label: english ? 'Owner only' : 'Apenas o proprietário',
        disabled: true,
        variant: 'outline' as const,
      };
    if (destination === 'plans')
      return {
        label: english ? 'Switch to this plan' : 'Mudar para este plano',
        disabled: false,
        variant: popular ? ('primary' as const) : ('outline' as const),
      };
    if (tier === 'free' && hasCurrentPaidPlan)
      return {
        label: english ? 'Switch to Free' : 'Mudar para Free',
        disabled: false,
        variant: 'outline' as const,
      };
    if (tier === 'free')
      return {
        label: english ? 'Switch to this plan' : 'Mudar para este plano',
        disabled: false,
        variant: 'outline' as const,
      };
    return {
      label: isUpgrade ? (english ? 'Upgrade plan' : 'Fazer upgrade') : (english ? 'Switch to this plan' : 'Mudar para este plano'),
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
    tier,
    checkoutLoading,
    billingInterval,
    locale,
  ]);

  const isActivePaidPlan =
    isCurrentPlan && (tier === 'pro' || tier === 'enterprise');
  const currentPlanLabel = currentPlan
    ? PLAN_NAMES[currentPlan as PlanTier]
    : (english ? 'Current plan' : 'Plano atual');
  const confirmationTitle = isDowngrade
    ? (english ? 'Confirm switching to a lower plan' : 'Confirmar mudança para um plano inferior')
    : (english ? 'Confirm upgrade' : 'Confirmar upgrade');
  const confirmationDescription =
    english ? 'After confirmation, you will continue to the applicable payment flow. Your current subscription will only change after the new payment is complete.' : 'Depois da confirmação vais para o processo de pagamento aplicável. A subscrição atual só será alterada depois de o novo pagamento ficar concluído.';

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
                    <Sparkles className="size-3" /> {english ? 'Recommended' : 'Recomendado'}
                  </span>
                )}
                {tier === 'pro' && trialDays ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                    <Gift className="size-3" /> {english ? '1 month free' : '1 mês grátis'}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
                {description}
              </p>
            </div>
            {isCurrentPlan && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                <Shield className="size-3" /> {english ? 'Active' : 'Ativo'}
              </span>
            )}
          </div>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight text-zinc-50">
              {price}
            </span>
            {tier !== 'free' && (
              <span className="text-xs text-zinc-500">
                {billingInterval === 'year' ? (english ? '/year' : '/ano') : (english ? '/month' : '/mês')}
              </span>
            )}
          </div>
          {tier === 'pro' && trialDays ? (
            <p className="mt-2 text-xs font-semibold text-emerald-300/90">
              {english ? '1 month of Pro free for eligible new users with code TRIALPRO.' : '1 mês de Pro grátis para novos utilizadores elegíveis com o código TRIALPRO.'}
            </p>
          ) : null}
          {tier === 'pro' && !trialDays ? (
            <p className="mt-2 text-xs font-medium text-emerald-300/90">
              {english ? 'Grow without adding complexity.' : 'Para crescer sem aumentar a complexidade.'}
            </p>
          ) : null}
          {tier === 'free' && (
            <p className="mt-2 text-xs text-zinc-500">
              {english ? 'No card required. Start today and upgrade when you need to.' : 'Sem cartão. Começa hoje e atualiza quando precisares.'}
            </p>
          )}
          {tier === 'enterprise' && (
            <p className="mt-2 text-xs text-zinc-500">
              {english ? 'For teams and multi-location operations.' : 'Para equipas e operações com várias localizações.'}
            </p>
          )}

          <div className="mt-7 space-y-3 border-t border-white/8 pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              {english ? 'Includes' : 'Inclui'}
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
            disabled={
              buttonConfig.disabled ||
              loading ||
              isChangingPlan ||
              checkoutLoading
            }
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-[background-color,border-color,box-shadow,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${buttonConfig.variant === 'primary' ? 'bg-emerald-400 text-zinc-950 shadow-[0_8px_24px_rgba(52,211,153,0.18)] hover:bg-emerald-300 hover:shadow-[0_10px_30px_rgba(52,211,153,0.24)]' : buttonConfig.variant === 'secondary' ? 'border border-white/10 bg-white/5 text-zinc-400' : 'border border-white/15 bg-white/[0.04] text-zinc-100 hover:border-white/25 hover:bg-white/[0.08]'}`}
          >
            {loading || isChangingPlan || checkoutLoading ? (
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
              {trialDays
                ? (english ? '1 month free for eligible new users. The regular price applies after that.' : '1 mês grátis para novos utilizadores elegíveis. Depois aplica-se o preço normal.')
                : (english ? 'Payment instructions and terms are shown during subscription.' : 'As instruções e condições de pagamento são apresentadas no processo de subscrição.')}
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
                {english ? 'Current' : 'Atual'}
              </p>
              <p className="mt-1 font-semibold text-zinc-100">
                {currentPlanLabel}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {english ? 'New plan' : 'Novo plano'}
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
              {english ? 'Cancel' : 'Cancelar'}
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
              {english ? 'Continue to checkout' : 'Ir para checkout'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
