'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleCheck,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  PricingCard,
  type PricingDestination,
} from '@/components/billing/PricingCard';
import { PLAN_DESCRIPTIONS } from '@/lib/billing/plan-features';

type BillingPrice = {
  id: string;
  plan: 'pro' | 'enterprise' | null;
  interval: 'month' | 'year' | null;
};

const HERO_FEATURES = {
  free: [
    'Agendamentos ilimitados',
    'Clientes e serviços ilimitados',
    'Reservas online + código QR',
    '1 barbeiro e 1 localização',
  ],
  pro: [
    'Até 5 barbeiros',
    'CRM e estatísticas avançadas',
    'Automação e campanhas de marketing',
    'Fidelização e seguimentos automáticos',
  ],
  enterprise: [
    'Barbeiros e localizações ilimitados',
    'POS, stock e comissões',
    'Permissões e gestão global',
    'Relatórios empresariais avançados',
  ],
} as const;

export function PricingSection({
  destination = 'plans',
  showDecisionHeader = true,
}: {
  destination?: PricingDestination;
  showDecisionHeader?: boolean;
}) {
  const [prices, setPrices] = useState<BillingPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [pricesError, setPricesError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPrices = async () => {
      setLoadingPrices(true);
      setPricesError(false);
      try {
        const response = await fetch('/api/stripe/prices', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const body = (await response.json().catch(() => ({}))) as {
          data?: BillingPrice[];
        };
        if (!response.ok || !Array.isArray(body.data)) {
          throw new Error('PRICES_UNAVAILABLE');
        }
        if (!cancelled) setPrices(body.data);
      } catch (error) {
        if (cancelled) return;
        console.error(
          '[PRICING_SECTION_LOAD_ERROR]',
          error instanceof Error ? error.name : 'UNKNOWN',
        );
        setPrices([]);
        setPricesError(true);
      } finally {
        if (!cancelled) setLoadingPrices(false);
      }
    };

    void loadPrices();
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const proPriceId = prices.find(
    (price) => price.plan === 'pro' && price.interval === 'month',
  )?.id;
  const enterprisePriceId = prices.find(
    (price) => price.plan === 'enterprise' && price.interval === 'month',
  )?.id;

  return (
    <section id="precos" className="space-y-8">
      {showDecisionHeader ? (
        <>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                <ShieldCheck className="size-3.5" aria-hidden="true" /> Decisão
                e checkout
              </div>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] text-zinc-50 sm:text-4xl lg:text-5xl">
                Escolhe o plano. O próximo passo é sempre o checkout.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                Compara o essencial, escolhe a fase certa da tua barbearia e
                continua sem saltos de página desnecessários. O pagamento
                acontece na experiência de checkout da Silentra.
              </p>
            </div>
            <Link
              href="#comparacao"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              Ver comparação <ArrowRight className="size-4" />
            </Link>
          </div>

          <div
            className="grid gap-2 sm:grid-cols-3"
            aria-label="Passos para aderir à Silentra"
          >
            {[
              ['01', 'Escolhe', 'Compara os planos e encontra o nível certo.'],
              [
                '02',
                'Checkout',
                'Revê os dados e conclui o pagamento dentro da Silentra.',
              ],
              [
                '03',
                'Ativa',
                'A subscrição fica ligada à tua barbearia e respetiva equipa.',
              ],
            ].map(([step, title, text]) => (
              <div
                key={step}
                className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-emerald-300">
                    {step}
                  </span>
                  <p className="text-sm font-semibold text-zinc-100">{title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{text}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {loadingPrices ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="glassmorphism flex min-h-[480px] items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/70 text-zinc-500"
              aria-label="A carregar preços"
            >
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            </div>
          ))}
        </div>
      ) : pricesError ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-6 text-center sm:p-8"
        >
          <p className="text-base font-semibold text-zinc-100">
            Não foi possível carregar os preços.
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            O checkout está temporariamente indisponível. Tenta novamente sem
            perder o contexto desta página.
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <PricingCard
            destination={destination}
            tier="free"
            title="Barbers Free"
            price="0 €"
            description={PLAN_DESCRIPTIONS.free}
            features={HERO_FEATURES.free}
          />
          <PricingCard
            destination={destination}
            tier="pro"
            title="Barbers Pro"
            price="9,90 €"
            priceId={proPriceId}
            description={PLAN_DESCRIPTIONS.pro}
            features={HERO_FEATURES.pro}
            popular
            trialDays={30}
          />
          <PricingCard
            destination={destination}
            tier="enterprise"
            title="Barbers Enterprise"
            price="29,99 €"
            priceId={enterprisePriceId}
            description={PLAN_DESCRIPTIONS.enterprise}
            features={HERO_FEATURES.enterprise}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glassmorphism rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <CircleCheck className="size-4 text-emerald-400" /> Free sem cartão
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Começa a operar sem pagamento obrigatório.
          </p>
        </div>
        <div className="glassmorphism rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <Check className="size-4 text-emerald-300" /> Oferta Pro para
            elegíveis
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            A oferta aplicável é validada no fluxo de checkout.
          </p>
        </div>
        <div className="glassmorphism rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <ShieldCheck className="size-4 text-emerald-400" /> Faturação
            transparente
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            A subscrição pertence à barbearia e é processada pela Stripe.
          </p>
        </div>
      </div>
    </section>
  );
}
