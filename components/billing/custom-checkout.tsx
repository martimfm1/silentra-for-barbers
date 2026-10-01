'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CheckoutElementsProvider,
  BillingAddressElement,
  PaymentElement,
  useCheckout,
} from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
);

const PLAN_COPY = {
  pro: {
    name: 'Barbers Pro',
    shortName: 'Pro',
    price: '9,90 € / mês',
    description:
      'Para barbearias que querem crescer com CRM, automações, campanhas e fidelização.',
    trial: '14 dias grátis para novos utilizadores elegíveis.',
    highlights: [
      'CRM e clientes',
      'Campanhas e automações',
      'Fidelização e estatísticas',
    ],
  },
  enterprise: {
    name: 'Barbers Enterprise',
    shortName: 'Enterprise',
    price: 'A partir de 29,90 € / mês',
    description:
      'Para equipas maiores, várias localizações, POS, stock e gestão avançada.',
    trial: null,
    highlights: [
      'Equipas e localizações',
      'Operação avançada',
      'Maior controlo e escala',
    ],
  },
} as const;

type CheckoutFormProps = { plan: keyof typeof PLAN_COPY };

function CheckoutForm({ plan }: CheckoutFormProps) {
  const checkoutState = useCheckout();
  const [promotionCode, setPromotionCode] = useState('');
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionApplied, setPromotionApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const applyPromotion = async () => {
    setPromotionError(null);
    if (checkoutState.type !== 'success' || !promotionCode.trim()) return;
    const response = await checkoutState.checkout.applyPromotionCode(
      promotionCode.trim(),
    );
    if (response.type === 'error') {
      setPromotionApplied(false);
      setPromotionError(response.error.message);
      return;
    }
    setPromotionApplied(true);
    setPromotionCode('');
  };

  const removePromotion = async () => {
    setPromotionError(null);
    if (checkoutState.type !== 'success') return;
    const response = await checkoutState.checkout.removePromotionCode();
    if (response.type === 'error') {
      setPromotionError(response.error.message);
      return;
    }
    setPromotionApplied(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkoutState.type !== 'success' || submitting) return;
    setSubmitting(true);
    setPromotionError(null);
    try {
      const result = await checkoutState.checkout.confirm({
        redirect: 'if_required',
      });
      if (result.type === 'error') {
        setPromotionError(result.error.message);
        setSubmitting(false);
        return;
      }
      window.location.assign('/dashboard/billing?checkout=success');
    } catch (error) {
      setPromotionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a subscrição.',
      );
      setSubmitting(false);
    }
  };

  if (checkoutState.type === 'loading')
    return (
      <div className="grid min-h-[540px] place-items-center rounded-2xl border border-white/8 bg-black/20 px-6 text-center">
        <div>
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <p className="mt-4 text-sm font-semibold text-white">
            A preparar o teu checkout
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            A carregar os dados de pagamento em segurança.
          </p>
        </div>
      </div>
    );
  if (checkoutState.type === 'error')
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5 sm:p-6">
        <p className="text-sm font-semibold text-red-100">
          Não foi possível carregar o checkout
        </p>
        <p className="mt-1 text-sm leading-6 text-red-200/70">
          {checkoutState.error.message}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-red-300/20 bg-red-300/5 px-4 text-sm font-semibold text-red-100 hover:bg-red-300/10"
        >
          Tentar novamente
        </button>
      </div>
    );

  const totalAmount = checkoutState.checkout.total.total.minorUnitsAmount;
  const currency = checkoutState.checkout.currency.toUpperCase();
  const isZeroTotal = totalAmount === 0;
  const formattedTotal = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
  }).format(totalAmount / 100);

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-zinc-950">
          1
        </span>
        <span className="text-zinc-300">Faturação</span>
        <ChevronRight className="size-3.5" />
        <span>Pagamento</span>
        <ChevronRight className="size-3.5" />
        <span>Confirmação</span>
      </div>
      <div className="rounded-2xl border border-emerald-300/15 bg-[linear-gradient(145deg,rgba(52,211,153,0.08),rgba(255,255,255,0.02))] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300/80">
              Hoje
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Total da subscrição
            </p>
            <p className="mt-1 max-w-xl text-xs leading-5 text-zinc-500">
              {isZeroTotal
                ? 'Não tens nenhum valor a pagar hoje. O preço normal começa no fim do trial, quando aplicável.'
                : 'Total atualizado automaticamente com descontos e impostos.'}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {formattedTotal}
          </p>
        </div>
        {isZeroTotal ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-300/15 bg-emerald-300/5 px-3 py-2 text-xs font-medium text-emerald-200">
            <Check className="size-3.5" />
            14 dias sem cobrança inicial
          </div>
        ) : null}
      </div>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.018]">
        <div className="border-b border-white/8 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Dados de faturação
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Necessários para a faturação da subscrição.
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <BillingAddressElement />
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.018]">
        <div className="border-b border-white/8 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-zinc-300">
                <CreditCard className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Pagamento</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Processado diretamente pela Stripe.
                </p>
              </div>
            </div>
            <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
              <LockKeyhole className="size-3.5 text-emerald-300" /> Seguro
            </span>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <PaymentElement options={{ layout: 'accordion' }} />
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.018]">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Código promocional
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Tens um código? Aplica-o antes de confirmar a subscrição.
              </p>
            </div>
            {promotionApplied ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                <Check className="size-3" />
                Aplicado
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="promotion-code">
              Código promocional
            </label>
            <input
              id="promotion-code"
              value={promotionCode}
              onChange={(event) => setPromotionCode(event.target.value)}
              placeholder="Ex.: SILENTRA20"
              autoComplete="off"
              className="min-h-11 flex-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3.5 text-sm text-white outline-none placeholder:text-zinc-600 transition focus:border-emerald-300/30 focus:ring-2 focus:ring-emerald-300/10 disabled:opacity-60"
              disabled={promotionApplied || submitting}
            />
            {promotionApplied ? (
              <button
                type="button"
                onClick={() => void removePromotion()}
                disabled={submitting}
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                Remover
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void applyPromotion()}
                disabled={submitting || !promotionCode.trim()}
                className="min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Aplicar
              </button>
            )}
          </div>
          {promotionError ? (
            <p role="alert" className="mt-2 text-xs leading-5 text-red-300">
              {promotionError}
            </p>
          ) : null}
        </div>
      </section>
      <div className="rounded-xl border border-white/8 bg-black/20 p-4 text-xs leading-5 text-zinc-500">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <p>
            Os dados de pagamento são processados diretamente pela Stripe. A
            Silentra não guarda o número completo do teu cartão.
          </p>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/8 bg-zinc-950/95 px-4 py-3 backdrop-blur sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 shadow-[0_10px_35px_rgba(52,211,153,0.12)] transition hover:-translate-y-0.5 hover:bg-emerald-300 active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
        >
          <LockKeyhole className="size-4" />
          {submitting
            ? 'A confirmar subscrição…'
            : isZeroTotal
              ? 'Começar os 14 dias grátis'
              : plan === 'pro'
                ? 'Confirmar e subscrever Pro'
                : 'Confirmar e subscrever Enterprise'}
        </button>
        <p className="mt-2 text-center text-[11px] leading-5 text-zinc-600">
          Ao confirmar, aceitas a cobrança recorrente aplicável ao plano
          selecionado.
        </p>
      </div>
    </form>
  );
}

export function CustomCheckout({
  priceId,
  plan,
}: {
  priceId: string;
  plan: keyof typeof PLAN_COPY;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const initializedKey = useRef<string | null>(null);
  const checkoutAttemptIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!priceId || initializedKey.current === priceId) return;
    initializedKey.current = priceId;
    checkoutAttemptIdRef.current = crypto.randomUUID();
    const checkoutAttemptId = checkoutAttemptIdRef.current;
    let cancelled = false;
    const initialize = async () => {
      try {
        setInitializationError(null);
        const response = await fetch('/api/stripe/embedded-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId, checkoutAttemptId }),
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error || 'Não foi possível iniciar o checkout.');
        if (!body.clientSecret)
          throw new Error(
            'O Stripe não devolveu uma sessão de checkout válida.',
          );
        if (!cancelled) setClientSecret(body.clientSecret as string);
      } catch (error) {
        if (!cancelled) {
          initializedKey.current = null;
          checkoutAttemptIdRef.current = null;
          setInitializationError(
            error instanceof Error
              ? error.message
              : 'Não foi possível iniciar o checkout.',
          );
        }
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [priceId]);

  const copy = PLAN_COPY[plan];
  if (initializationError)
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-6">
        <p className="text-sm font-semibold text-red-100">
          Não foi possível iniciar o checkout
        </p>
        <p className="mt-1 text-sm leading-6 text-red-200/70">
          {initializationError}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg border border-red-300/20 bg-red-300/5 px-4 text-sm font-semibold text-red-100 hover:bg-red-300/10"
        >
          Tentar novamente
        </button>
      </div>
    );
  if (!clientSecret)
    return (
      <div className="mx-auto grid min-h-[540px] max-w-6xl place-items-center rounded-2xl border border-white/8 bg-zinc-900/50 px-6 text-center">
        <div>
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <p className="mt-4 text-sm font-semibold text-white">
            A preparar o checkout seguro…
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Estamos a criar uma sessão segura para o teu plano.
          </p>
        </div>
      </div>
    );

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: {
          loader: 'auto',
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#34d399',
              colorBackground: '#09090b',
              colorText: '#f4f4f5',
              colorTextSecondary: '#a1a1aa',
              colorDanger: '#f87171',
              borderRadius: '12px',
              fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
            },
          },
        },
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-7 lg:sticky lg:top-6 lg:h-fit">
          <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            <Sparkles className="size-4" />
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
            Checkout Silentra
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
            {copy.name}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {copy.description}
          </p>
          {copy.trial ? (
            <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4">
              <p className="text-xs font-semibold text-emerald-200">
                {copy.trial}
              </p>
            </div>
          ) : null}
          <div className="mt-6 space-y-3 border-t border-white/8 pt-5">
            {copy.highlights.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-sm text-zinc-300"
              >
                <Check className="size-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
          <Link
            href="/plans"
            className="mt-7 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            Voltar aos planos
          </Link>
        </aside>
        <div className="min-w-0">
          <CheckoutForm plan={plan} />
        </div>
      </div>
    </CheckoutElementsProvider>
  );
}
