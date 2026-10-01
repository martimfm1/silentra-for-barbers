'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_NAMES } from '@/lib/billing/plan-features';

export function SubscriptionManagementCard() {
  const {
    subscription,
    cancellation,
    plan,
    planSource,
    isAdministrativePlan,
    isTrial,
    loading,
  } = useSubscription();
  const [openingPortal, setOpeningPortal] = useState(false);
  const hasStripeSubscription = Boolean(subscription?.stripe_subscription_id);
  const isCanceled = subscription?.status === 'canceled';
  const displayedPlan = cancellation?.previousPlan ?? plan;
  const shouldUpgrade = cancellation?.previousPlan === 'pro';

  const openPortal = async () => {
    try {
      setOpeningPortal(true);
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.url !== 'string')
        throw new Error(
          body.error || 'Não foi possível abrir a gestão de faturação.',
        );
      window.location.assign(body.url);
    } catch (error) {
      setOpeningPortal(false);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir a gestão de faturação.',
      );
    }
  };

  const formatDate = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : '—';

  const formatCancellationDate = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString('pt-PT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : '—';

  const source = isAdministrativePlan
    ? 'Administração Silentra'
    : planSource === 'stripe'
      ? 'Stripe'
      : planSource === 'subscription_override'
        ? 'Override da subscrição'
        : 'Plano gratuito';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.22)] sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-emerald-400/[0.07] blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              <ShieldCheck className="size-3.5" /> Plano{' '}
              {PLAN_NAMES[displayedPlan]}
            </span>
            {isCanceled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[11px] font-semibold text-red-200">
                Subscrição cancelada
              </span>
            )}
            {isAdministrativePlan && !isCanceled && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-200">
                <Sparkles className="size-3.5" /> Gerido pela Silentra
              </span>
            )}
            {isTrial && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-200">
                <Zap className="size-3.5" /> Trial ativo
              </span>
            )}
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {isCanceled ? 'Subscrição cancelada' : 'Gestão da subscrição'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {isCanceled
              ? `Esta subscrição foi cancelada em ${formatCancellationDate(cancellation?.canceledAt)}${cancellation?.canceledByEmail ? ` por ${cancellation.canceledByEmail}` : ''}.`
              : isAdministrativePlan
                ? 'Este plano é atribuído pela administração da Silentra e aplica-se a todos os membros da barbearia.'
                : hasStripeSubscription
                  ? 'Cartões, faturas, alterações de plano e cancelamento são geridos no Customer Portal seguro da Stripe.'
                  : 'Estás no plano gratuito. Escolhe um plano quando precisares de funcionalidades adicionais.'}
          </p>
        </div>

        {isCanceled ? (
          <a
            href="/plans"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          >
            {shouldUpgrade
              ? 'Melhorar para Enterprise'
              : `Voltar a subscrever ${PLAN_NAMES[displayedPlan]}`}
          </a>
        ) : hasStripeSubscription && !isAdministrativePlan ? (
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={loading || openingPortal}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
          >
            {openingPortal ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ExternalLink className="size-4" />
            )}
            {openingPortal ? 'A abrir…' : 'Gerir faturação'}
          </button>
        ) : (
          <a
            href="/plans"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
          >
            Ver planos
          </a>
        )}
      </div>

      <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Origem
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-100">{source}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            Estado
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-100">
            {isAdministrativePlan && !isCanceled
              ? 'Atribuído'
              : isCanceled
                ? 'Cancelada'
                : subscription?.cancel_at_period_end
                  ? 'Cancelamento agendado'
                  : subscription?.status === 'trialing'
                    ? 'Em trial'
                    : hasStripeSubscription
                      ? 'Ativo'
                      : 'Gratuito'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            {isCanceled ? 'Cancelada em' : 'Próxima renovação'}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-100">
            {isCanceled
              ? formatCancellationDate(cancellation?.canceledAt)
              : isAdministrativePlan
                ? 'Gerido pela Silentra'
                : formatDate(subscription?.current_period_end)}
          </p>
        </div>
      </div>
    </section>
  );
}
