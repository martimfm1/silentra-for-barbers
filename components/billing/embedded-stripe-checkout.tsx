'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
);

export function EmbeddedStripeCheckout() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const priceId = new URLSearchParams(window.location.search).get('priceId');
    if (!priceId) {
      setError('Não foi selecionado nenhum plano para o checkout.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void fetch('/api/stripe/embedded-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error || 'Não foi possível iniciar o checkout.');
        return body as { clientSecret?: string };
      })
      .then(({ clientSecret: secret }) => {
        if (cancelled) return;
        if (!secret)
          throw new Error(
            'O Stripe não devolveu uma sessão de checkout válida.',
          );
        setClientSecret(secret);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível iniciar o checkout.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            onComplete: () => {
              void (async () => {
                try {
                  const response = await fetch(
                    '/api/stripe/checkout-complete',
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      cache: 'no-store',
                    },
                  );

                  const body = (await response.json().catch(() => ({}))) as {
                    error?: string;
                  };

                  if (!response.ok) {
                    console.error('[STRIPE_CHECKOUT_COMPLETE_CLIENT_ERROR]', {
                      status: response.status,
                      error: body.error ?? 'Unknown synchronization error',
                    });
                  }
                } catch {
                  console.error('[STRIPE_CHECKOUT_COMPLETE_CLIENT_CRITICAL]');
                } finally {
                  window.location.assign('/checkout/success');
                }
              })();
            },
          }
        : undefined,
    [clientSecret],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/dashboard/billing"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="size-4 text-emerald-300" /> Pagamento
          protegido pela Stripe
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
              Checkout Silentra
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              Finaliza a tua subscrição
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              O pagamento é processado pela Stripe, mas o checkout permanece
              integrado na Silentra. Os códigos promocionais e os dados de
              faturação aparecem diretamente no checkout.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center p-6 text-sm text-zinc-500">
            A preparar o checkout…
          </div>
        ) : null}
        {error ? (
          <div className="flex min-h-[420px] items-center justify-center p-6 text-center">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-white">
                Não foi possível carregar o checkout
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{error}</p>
              <Link
                href="/dashboard/billing"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-950"
              >
                Voltar ao billing
              </Link>
            </div>
          </div>
        ) : null}
        {options ? (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <div className="min-h-[680px] bg-zinc-950">
              <EmbeddedCheckout />
            </div>
          </EmbeddedCheckoutProvider>
        ) : null}
      </div>
    </div>
  );
}
