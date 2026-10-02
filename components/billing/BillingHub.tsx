'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Download,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { useCheckout } from '@/hooks/useCheckout';
import { PLAN_NAMES } from '@/lib/billing/plan-features';

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
  plan: string;
  date: string;
  invoice_pdf: string | null;
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export function BillingHub() {
  const {
    subscription,
    cancellation,
    plan,
    planSource,
    isAdministrativePlan,
    isTrial,
    loading,
    paymentMode,
    manualRequest,
    cancel,
    resume,
    billingInterval,
  } = useSubscription();
  const { checkout: beginCheckout, loading: checkoutLoading } = useCheckout();
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const isStripeSubscription =
    subscription?.payment_method === 'STRIPE' &&
    Boolean(subscription?.stripe_subscription_id);
  const isManualSubscription =
    subscription?.payment_method === 'MANUAL' &&
    subscription.plan !== 'free' &&
    (subscription.status === 'active' || subscription.status === 'trialing');
  const hasSubscription = isStripeSubscription || isManualSubscription;
  const isCanceled =
    subscription?.status === 'canceled' && subscription.plan !== 'free';
  const active =
    subscription?.status === 'active' || subscription?.status === 'trialing';
  const canceledPlan = cancellation?.previousPlan ?? 'free';
  const displayPlan =
    manualRequest && !subscription?.stripe_subscription_id && plan === 'free'
      ? manualRequest.plan
      : plan;
  const renewalPlan =
    canceledPlan === 'pro'
      ? 'enterprise'
      : canceledPlan === 'enterprise'
        ? 'enterprise'
        : 'pro';
  const currentPeriodEnd = subscription?.current_period_end ?? null;
  const nextRenewal = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const cancellationDate = cancellation?.canceledAt
    ? new Date(cancellation.canceledAt).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  useEffect(() => {
    if (!isStripeSubscription || isAdministrativePlan) return;
    let cancelled = false;
    setLoadingInvoices(true);
    fetch('/api/stripe/invoices', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            body.error || 'Não foi possível carregar os recibos.',
          );
        return body.invoices;
      })
      .then((data) => {
        if (!cancelled) setInvoices(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (!cancelled)
          toast.error(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar os recibos.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isStripeSubscription, isAdministrativePlan]);

  const handleCancel = async () => {
    if (!active || isAdministrativePlan) return;
    const confirmed = window.confirm(
      'Cancelar a subscrição no final do período atual? O acesso mantém-se até à data de renovação.',
    );
    if (!confirmed) return;
    try {
      setCancelling(true);
      await cancel();
      toast.success(
        'Cancelamento agendado. O plano continua ativo até ao fim do período atual.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível cancelar a subscrição.',
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleResume = async () => {
    try {
      setResuming(true);
      await resume();
      toast.success('Subscrição retomada com sucesso.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível retomar a subscrição.',
      );
    } finally {
      setResuming(false);
    }
  };

  const handleResubscribe = async () => {
    try {
      await beginCheckout({
        plan: renewalPlan === 'enterprise' ? 'enterprise' : 'pro',
        interval: billingInterval ?? 'month',
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a nova subscrição.',
      );
    }
  };

  const handleOpenCustomerPortal = async () => {
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
          : 'Não foi possível abrir o Customer Portal.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.2)] sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                <ShieldCheck className="size-3.5" /> Subscrição
              </span>
              {isCanceled && (
                <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200">
                  Cancelada
                </span>
              )}
              {isTrial && !isCanceled && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                  Trial ativo
                </span>
              )}
            </div>

            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              {isCanceled ||
              (manualRequest?.status === 'EXPIRED' && plan === 'free')
                ? PLAN_NAMES[manualRequest?.plan ?? canceledPlan]
                : PLAN_NAMES[displayPlan]}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              {isCanceled
                ? `Esta subscrição foi cancelada em ${cancellationDate}${cancellation?.canceledByName ? ` por ${cancellation.canceledByName}` : cancellation?.canceledByEmail ? ` por ${cancellation.canceledByEmail}` : ''}.`
                : isAdministrativePlan
                  ? 'Plano atribuído pela administração da Silentra e aplicado à barbearia.'
                  : hasSubscription
                    ? 'A subscrição é sincronizada com a Stripe e pertence à barbearia.'
                    : 'Plano gratuito, sem subscrição paga ativa.'}
            </p>
          </div>

          <div className="grid min-w-[220px] grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                Estado
              </p>
              <p className="mt-2 font-medium text-zinc-100">
                {isAdministrativePlan && !isCanceled
                  ? 'Atribuído'
                  : isCanceled
                    ? 'Cancelada'
                    : subscription?.cancel_at_period_end
                      ? 'Cancelamento agendado'
                      : active
                        ? isTrial
                          ? 'Em trial'
                          : 'Ativo'
                        : 'Gratuito'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                {isCanceled ? 'Cancelada em' : 'Renovação'}
              </p>
              <p className="mt-2 font-medium text-zinc-100">
                {isCanceled
                  ? cancellationDate
                  : isAdministrativePlan
                    ? '—'
                    : nextRenewal}
              </p>
            </div>
          </div>
        </div>

        {isCanceled && cancellation?.canceledByName ? (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              Cancelada por
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {cancellation.canceledByName}
              {cancellation.canceledByEmail
                ? ` · ${cancellation.canceledByEmail}`
                : ''}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Origem:{' '}
            {isAdministrativePlan
              ? 'Administração Silentra'
              : planSource === 'stripe'
                ? 'Stripe'
                : planSource === 'manual'
                  ? 'Pagamento manual'
                  : 'Plano gratuito'}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            {!isCanceled && (
              <Link
                href="/plans"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.07]"
              >
                Comparar planos <ArrowRight className="size-4" />
              </Link>
            )}

            {isCanceled ? (
              <button
                type="button"
                onClick={handleResubscribe}
                disabled={checkoutLoading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
              >
                {checkoutLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
                {canceledPlan === 'pro'
                  ? 'Melhorar para Enterprise'
                  : `Voltar a subscrever ${PLAN_NAMES[canceledPlan]}`}
              </button>
            ) : null}

            {isStripeSubscription && !isAdministrativePlan && !isCanceled && (
              <button
                type="button"
                onClick={() => void handleOpenCustomerPortal()}
                disabled={openingPortal || loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
              >
                {openingPortal ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Gerir faturação na Stripe
              </button>
            )}

            {active &&
              !isAdministrativePlan &&
              !subscription?.cancel_at_period_end &&
              !isCanceled && (
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={cancelling || loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 text-sm font-semibold text-red-200 transition hover:bg-red-400/10 disabled:cursor-wait disabled:opacity-60"
                >
                  {cancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  Cancelar subscrição
                </button>
              )}

            {subscription?.cancel_at_period_end &&
            (isStripeSubscription || isManualSubscription) &&
            !isCanceled ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 text-sm font-medium text-amber-200">
                  <CalendarDays className="size-4" /> Cancelamento agendado (
                  {nextRenewal})
                </span>
                <button
                  type="button"
                  onClick={() => void handleResume()}
                  disabled={resuming || loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/10 disabled:cursor-wait disabled:opacity-60"
                >
                  {resuming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Retomar subscrição
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {(paymentMode === 'MANUAL' && !isStripeSubscription) ? (
      <section className="rounded-3xl border border-white/10 bg-zinc-900/50 p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              Pagamento manual
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">Estado do pedido</h3>
          </div>
          {manualRequest ? (
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {manualRequest.status.replace('_', ' ')}
            </span>
          ) : null}
        </div>
        <div className="mt-5">
          {manualRequest?.status === 'PENDING' ? (
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-sm leading-6 text-amber-100/80">
              O pedido foi recebido. A equipa irá preparar o pagamento e enviar-te as instruções para o email associado à tua conta.
            </div>
          ) : manualRequest?.status === 'PAYMENT_SENT' && manualRequest.paymentLink ? (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
              <p className="text-sm leading-6 text-zinc-300">
                O link de pagamento já foi enviado. Podes abrir o pagamento diretamente aqui.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <a href={manualRequest.paymentLink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-zinc-950">
                  Pagar agora
                </a>
                <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-xs text-zinc-500">
                  {manualRequest.plan === 'enterprise' ? 'Enterprise' : 'Pro'} · {manualRequest.billingInterval === 'year' ? 'Anual' : 'Mensal'} · {formatAmount(manualRequest.price, manualRequest.currency)}
                </span>
              </div>
            </div>
          ) : manualRequest?.status === 'PAID' ? (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4 text-sm leading-6 text-emerald-100/80">
              O pagamento foi confirmado e a tua subscrição manual está ativa.
            </div>
          ) : manualRequest?.status === 'EXPIRED' ? (
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4 text-sm leading-6 text-amber-100/80">
              O período da subscrição terminou. Para continuar, escolhe novamente um plano em <Link href="/plans" className="font-semibold text-emerald-300 hover:text-emerald-200">/plans</Link>.
            </div>
          ) : manualRequest?.status === 'REJECTED' ? (
            <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.04] p-4 text-sm leading-6 text-red-200">
              O último pedido de pagamento foi rejeitado. Podes criar um novo pedido através da página de planos.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-zinc-500">
              Não existe nenhum pedido de pagamento manual em curso.
            </div>
          )}
        </div>
      </section>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-zinc-900/50 p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              Recibos
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              Histórico de faturação
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Consulta e descarrega os recibos emitidos pela Stripe.
            </p>
          </div>
          {hasSubscription && !isAdministrativePlan && (
            <span className="text-xs text-zinc-600">Últimos 12</span>
          )}
        </div>
        <div className="mt-5 space-y-2">
          {loadingInvoices ? (
            <div className="flex items-center justify-center rounded-2xl border border-white/8 bg-black/20 py-10 text-zinc-500">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : !hasSubscription || isAdministrativePlan ? (
            <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-500">
              Ainda não existem recibos de uma subscrição Stripe nesta conta.
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-sm text-zinc-500">
              Ainda não existem recibos emitidos.
            </div>
          ) : (
            invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      {invoice.plan}
                    </p>
                    <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-0.5 text-[10px] text-emerald-200">
                      {invoice.status ?? 'processado'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {invoice.date} ·{' '}
                    {formatAmount(invoice.amount, invoice.currency)}
                  </p>
                </div>
                {invoice.invoice_pdf ? (
                  <a
                    href={invoice.invoice_pdf}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.08]"
                  >
                    <Download className="size-3.5" /> Descarregar
                  </a>
                ) : (
                  <span className="text-xs text-zinc-600">
                    Recibo indisponível
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <Check className="size-3.5 text-emerald-400" /> Pagamentos e recibos
        processados pela Stripe. A Silentra não guarda dados do cartão.
      </div>
    </div>
  );
}
      ) : null}

