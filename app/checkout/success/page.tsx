'use client';

import Link from 'next/link';
import { trackMarketingEvent } from '@/lib/analytics/marketing';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

type Payload = {
  success?: boolean;
  plan?: 'free' | 'pro' | 'enterprise';
  status?: string;
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
  error?: string;
  barbershopName?: string | null;
  promotion?: {
    applied: boolean;
    code: string | null;
    discountAmount: number;
    currency: string | null;
    percentOff: number | null;
    amountOff: number | null;
  } | null;
};

const PLAN_NAMES = {
  free: 'Barbers Free',
  pro: 'Barbers Pro',
  enterprise: 'Barbers Enterprise',
} as const;

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : null;
}

function formatMoney(amountInCents: number, currency: string | null) {
  if (!currency || !Number.isFinite(amountInCents)) return null;
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}

export default function CheckoutSuccessPage() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id')?.trim() || null;

      for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
        try {
          if (!sessionId) {
            await fetch('/api/stripe/checkout-complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
            }).catch(() => undefined);
          }

          const subscriptionEndpoint = sessionId
            ? `/api/stripe/subscription?session_id=${encodeURIComponent(sessionId)}`
            : '/api/stripe/subscription';

          const [subscriptionResponse, summaryResponse, promotionResponse] =
            await Promise.all([
              fetch(subscriptionEndpoint, { cache: 'no-store' }),
              fetch('/api/stripe/billing-summary', { cache: 'no-store' }),
              fetch('/api/stripe/checkout-promotion', { cache: 'no-store' }),
            ]);

          const subscriptionBody = await subscriptionResponse
            .json()
            .catch(() => ({}));
          const summaryBody = await summaryResponse.json().catch(() => ({}));
          const promotionBody = await promotionResponse
            .json()
            .catch(() => ({}));

          if (subscriptionResponse.ok) {
            const subscription = subscriptionBody.subscription;
            const plan = subscriptionBody.plan as Payload['plan'];
            const stripeSubscriptionId =
              subscriptionBody.stripeSubscriptionId ??
              subscription?.stripe_subscription_id ??
              null;
            const active = Boolean(
              stripeSubscriptionId &&
              (plan === 'pro' || plan === 'enterprise') &&
              subscription &&
              ['active', 'trialing'].includes(subscription.status),
            );

            if (active) {
              if (!cancelled) {
                const conversionKey = stripeSubscriptionId
                  ? `silentra-subscription-activated:${stripeSubscriptionId}`
                  : null;
                let shouldTrackConversion = Boolean(conversionKey);
                if (conversionKey) {
                  try {
                    if (window.sessionStorage.getItem(conversionKey)) {
                      shouldTrackConversion = false;
                    } else {
                      window.sessionStorage.setItem(conversionKey, '1');
                    }
                  } catch {
                    // Tracking must never block the successful checkout experience.
                  }
                }
                if (shouldTrackConversion) {
                  trackMarketingEvent('silentra_subscription_activated', {
                    plan: String(plan),
                    subscription_status: String(subscription.status),
                  });
                }

                setPayload({
                  success: true,
                  plan,
                  status: subscription.status,
                  trialEnd: subscription.trial_end ?? null,
                  currentPeriodEnd: subscription.current_period_end ?? null,
                  barbershopName: summaryBody.barbershopName ?? null,
                  promotion: promotionBody.applied ? promotionBody : null,
                });
                setLoading(false);
              }
              return;
            }
          }

          if (attempt < 5) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
            continue;
          }

          if (!cancelled) {
            setPayload({
              error:
                subscriptionBody.error ||
                'A subscrição ainda não está disponível para confirmação.',
            });
            setLoading(false);
          }
        } catch (error) {
          if (attempt < 5) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
            continue;
          }
          if (!cancelled) {
            setPayload({
              error:
                error instanceof Error
                  ? error.message
                  : 'Não foi possível confirmar a subscrição.',
            });
            setLoading(false);
          }
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 text-white">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            <Loader2 className="size-5 animate-spin" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">
            A confirmar a tua subscrição…
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Estamos a sincronizar Stripe e Supabase.
          </p>
        </div>
      </main>
    );
  }

  if (!payload?.success) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-red-400/20 bg-zinc-900/80 p-7 text-center">
          <h1 className="text-2xl font-semibold">
            Não foi possível confirmar a subscrição
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {payload?.error || 'Não foi possível concluir a sincronização.'}
          </p>
          <Link
            href="/dashboard/billing"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950"
          >
            Ir para billing <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
    );
  }

  const planName = payload.plan ? PLAN_NAMES[payload.plan] : 'A tua subscrição';
  const trialEnd = formatDate(payload.trialEnd);
  const periodEnd = formatDate(payload.currentPeriodEnd);
  const barbershopName = payload.barbershopName?.trim() || 'Barbearia';
  const promotionAmount = payload.promotion
    ? formatMoney(payload.promotion.discountAmount, payload.promotion.currency)
    : null;
  const promotionLabel =
    payload.promotion?.percentOff != null
      ? `${payload.promotion.percentOff}% de desconto`
      : promotionAmount
        ? `${promotionAmount} de desconto`
        : 'Desconto aplicado';

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] border border-emerald-400/15 bg-zinc-900/80 p-7 shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:p-10">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            <CheckCircle2 className="size-7" />
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
            Subscrição confirmada
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Tudo certo. O teu plano está ativo.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
            A subscrição Stripe foi sincronizada e ficou associada à tua
            barbearia.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-zinc-500">
                <ShieldCheck className="size-4 text-emerald-300" />
                <span className="text-xs uppercase tracking-[0.12em]">
                  Plano
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold text-white">
                {planName}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-zinc-500">
                <Building2 className="size-4 text-emerald-300" />
                <span className="text-xs uppercase tracking-[0.12em]">
                  Barbearia
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold text-white">
                {barbershopName}
              </p>
            </div>
          </div>

          {payload.promotion?.applied ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                  <BadgePercent className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300/80">
                    Código promocional ativo
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">
                    {payload.promotion.code || 'Código aplicado'}
                  </p>
                  <p className="mt-1 text-sm text-emerald-100">
                    {promotionLabel}
                  </p>
                  {promotionAmount ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      Poupança aplicada:{' '}
                      <strong className="text-zinc-200">
                        {promotionAmount}
                      </strong>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {trialEnd ? (
            <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4 text-sm text-emerald-100">
              Trial ativo até <strong>{trialEnd}</strong>.
            </div>
          ) : null}
          {periodEnd && !trialEnd ? (
            <p className="mt-4 text-xs text-zinc-500">
              Período atual até {periodEnd}.
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950"
            >
              Ir para dashboard <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/dashboard/billing"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-zinc-100"
            >
              Ver faturação
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
