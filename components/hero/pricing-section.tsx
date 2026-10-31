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
import { useLanguage } from '@/context/LanguageContext';

type BillingPrice = {
  plan: 'pro' | 'enterprise' | null;
  interval: 'month' | 'year' | null;
  unitAmount?: number;
  currency?: string;
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
    'Landing page profissional e domínio Silentra incluídos',
    'Site próprio com ativação única de 50 €',
  ],
} as const;

const HERO_FEATURES_EN = {
  free: [
    'Unlimited bookings',
    'Unlimited customers and services',
    'Online bookings + QR code',
    '1 barber and 1 location',
  ],
  pro: [
    'Up to 5 barbers',
    'Advanced CRM and analytics',
    'Marketing campaigns and automation',
    'Loyalty and automated follow-ups',
  ],
  enterprise: [
    'Unlimited barbers and locations',
    'POS, inventory and commissions',
    'Global permissions and management',
    'Advanced business reports',
    'Professional landing page and Silentra domain included',
    'Custom website with a one-time €50 setup fee',
  ],
} as const;

export function PricingSection({
  destination = 'plans',
  showDecisionHeader = true,
}: {
  destination?: PricingDestination;
  showDecisionHeader?: boolean;
}) {
  const { locale } = useLanguage();
  const english = locale === 'en';
  const featureCopy = english ? HERO_FEATURES_EN : HERO_FEATURES;
  const descriptions = english
    ? {
        free: 'The essentials to start taking bookings and keep your barbershop organised.',
        pro: 'For barbershops ready to grow, retain customers and automate daily operations.',
        enterprise:
          'For larger teams, with a landing page and public address on the Silentra domain included.',
      }
    : {
        free: 'O essencial para começar a receber marcações e organizar a barbearia.',
        pro: 'Para barbearias que querem crescer, fidelizar clientes e automatizar o dia a dia.',
        enterprise:
          'Para equipas maiores, landing page e endereço público no domínio Silentra incluídos.',
      };
  const [prices, setPrices] = useState<BillingPrice[]>([]);
  const [paymentMode, setPaymentMode] = useState<'MANUAL' | 'STRIPE'>('MANUAL');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>(
    'month',
  );
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
          mode?: 'MANUAL' | 'STRIPE';
        };
        if (!response.ok || !Array.isArray(body.data)) {
          throw new Error('PRICES_UNAVAILABLE');
        }
        if (!cancelled) {
          setPrices(body.data);
          setPaymentMode(body.mode === 'STRIPE' ? 'STRIPE' : 'MANUAL');
        }
      } catch (error) {
        if (cancelled) return;
        console.error(
          '[PRICING_SECTION_LOAD_ERROR]',
          error instanceof Error ? error.name : 'UNKNOWN',
        );
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

  const formatPrice = (plan: 'pro' | 'enterprise') => {
    const amount = prices.find(
      (price) => price.plan === plan && price.interval === billingInterval,
    )?.unitAmount;

    if (typeof amount !== 'number') {
      return english
        ? plan === 'pro'
          ? '€9.90'
          : '€29.90'
        : plan === 'pro'
          ? '9,90 €'
          : '29,90 €';
    }

    return new Intl.NumberFormat(english ? 'en-GB' : 'pt-PT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  };

  const annualAvailable =
    prices.some((price) => price.plan === 'pro' && price.interval === 'year') &&
    prices.some(
      (price) => price.plan === 'enterprise' && price.interval === 'year',
    );

  return (
    <section id="precos" className="space-y-8">
      {!loadingPrices && !pricesError && (
        <div className="flex justify-start sm:justify-end">
          <div
            className="inline-flex rounded-xl border border-white/10 bg-white/[0.025] p-1"
            role="group"
            aria-label={english ? 'Billing interval' : 'Período de faturação'}
          >
            <button
              type="button"
              onClick={() => setBillingInterval('month')}
              aria-pressed={billingInterval === 'month'}
              className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${
                billingInterval === 'month'
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
              }`}
            >
              {english ? 'Monthly' : 'Mensal'}
            </button>
            <button
              type="button"
              disabled={!annualAvailable}
              onClick={() => setBillingInterval('year')}
              aria-pressed={billingInterval === 'year'}
              className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${
                billingInterval === 'year'
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {english ? 'Yearly' : 'Anual'}
            </button>
          </div>
        </div>
      )}

      {showDecisionHeader ? (
        <>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                <ShieldCheck className="size-3.5" aria-hidden="true" />{' '}
                {english ? 'Plan selection and checkout' : 'Decisão e checkout'}
              </div>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] text-zinc-50 sm:text-4xl lg:text-5xl">
                {english
                  ? 'Choose your plan. Next: '
                  : 'Escolhe o plano. O próximo passo é '}
                {paymentMode === 'MANUAL'
                  ? english
                    ? 'a subscription request.'
                    : 'o pedido de subscrição.'
                  : english
                    ? 'checkout.'
                    : 'o checkout.'}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {english
                  ? 'Compare the essentials and choose the right plan for your barbershop. '
                  : 'Compara o essencial e escolhe a fase certa da tua barbearia. '}
                {paymentMode === 'MANUAL'
                  ? english
                    ? 'Your request is recorded and the team will send payment instructions.'
                    : 'O pedido é registado e a equipa envia-te as instruções de pagamento.'
                  : english
                    ? 'Payment takes place in Silentra checkout.'
                    : 'O pagamento acontece na experiência de checkout da Silentra.'}
              </p>
            </div>
            <Link
              href="#comparacao"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {english ? 'Compare plans' : 'Ver comparação'}{' '}
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div
            className="grid gap-2 sm:grid-cols-3"
            aria-label={
              english
                ? 'Steps to subscribe to Silentra'
                : 'Passos para aderir à Silentra'
            }
          >
            {[
              [
                '01',
                english ? 'Choose' : 'Escolhe',
                english
                  ? 'Compare plans and find the right fit.'
                  : 'Compara os planos e encontra o nível certo.',
              ],
              [
                '02',
                paymentMode === 'MANUAL'
                  ? english
                    ? 'Request'
                    : 'Pedido'
                  : 'Checkout',
                paymentMode === 'MANUAL'
                  ? english
                    ? 'Submit your request and wait for payment instructions.'
                    : 'Regista o pedido e aguarda as instruções de pagamento.'
                  : english
                    ? 'Review your details and complete payment with Silentra.'
                    : 'Revê os dados e conclui o pagamento dentro da Silentra.',
              ],
              [
                '03',
                english ? 'Activate' : 'Ativa',
                english
                  ? 'Your subscription is linked to your barbershop and its team.'
                  : 'A subscrição fica ligada à tua barbearia e respetiva equipa.',
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
              aria-label={english ? 'Loading prices' : 'A carregar preços'}
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
            {english
              ? 'We could not load prices.'
              : 'Não foi possível carregar os preços.'}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {english
              ? 'Checkout is temporarily unavailable. Try again without losing your place on this page.'
              : 'O checkout está temporariamente indisponível. Tenta novamente sem perder o contexto desta página.'}
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-zinc-100 hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {english ? 'Try again' : 'Tentar novamente'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <PricingCard
            destination={destination}
            tier="free"
            title="Barbers Free"
            price={english ? '€0' : '0 €'}
            description={descriptions.free}
            features={featureCopy.free}
          />
          <PricingCard
            destination={destination}
            billingInterval={billingInterval}
            tier="pro"
            title="Barbers Pro"
            price={formatPrice('pro')}
            description={descriptions.pro}
            features={featureCopy.pro}
            popular
            trialDays={
              paymentMode === 'STRIPE' && billingInterval === 'month'
                ? 30
                : undefined
            }
          />
          <PricingCard
            destination={destination}
            billingInterval={billingInterval}
            tier="enterprise"
            title="Barbers Enterprise"
            price={formatPrice('enterprise')}
            description={descriptions.enterprise}
            features={featureCopy.enterprise}
          />
        </div>
      )}

      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.045] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-zinc-100">
              {english
                ? 'Need a website built for your barbershop?'
                : 'Queres um site feito à medida da tua barbearia?'}
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
              {english
                ? 'Enterprise includes the landing page and a public address on the Silentra domain. A custom website has a one-time €50 activation fee, with no additional monthly charge.'
                : 'O Enterprise inclui a landing page e um endereço público no domínio Silentra. O site próprio tem uma ativação única de 50 €, sem mensalidade adicional.'}
            </p>
          </div>
        </div>
        <Link
          href={`mailto:silentra.contact@gmail.com?subject=${encodeURIComponent(english ? 'Enterprise custom website' : 'Site próprio Enterprise')}`}
          className="mt-4 inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 hover:bg-emerald-200 sm:mt-0 sm:w-auto"
        >
          {english ? 'Request website activation' : 'Pedir ativação do site'}{' '}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="glassmorphism rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <CircleCheck className="size-4 text-emerald-400" />{' '}
            {english ? 'Free, no card required' : 'Free sem cartão'}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {english
              ? 'Start using the platform without a mandatory payment.'
              : 'Começa a operar sem pagamento obrigatório.'}
          </p>
        </div>
        <div className="glassmorphism rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <Check className="size-4 text-emerald-300" />{' '}
            {paymentMode === 'MANUAL'
              ? english
                ? 'Manual payment'
                : 'Pagamento manual'
              : english
                ? 'Eligible Pro offer'
                : 'Oferta Pro para elegíveis'}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {paymentMode === 'MANUAL'
              ? english
                ? 'You will receive payment instructions after your request is processed.'
                : 'Recebe as instruções de pagamento depois de o pedido ser processado.'
              : english
                ? 'Any applicable offer is validated during checkout.'
                : 'A oferta aplicável é validada no fluxo de checkout.'}
          </p>
        </div>
        <div className="glassmorphism rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <ShieldCheck className="size-4 text-emerald-400" />{' '}
            {english ? 'Transparent billing' : 'Faturação transparente'}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {paymentMode === 'MANUAL'
              ? english
                ? 'The request is linked to your barbershop and recorded as a manual payment.'
                : 'O pedido fica associado à tua barbearia e o método é registado como manual.'
              : english
                ? 'The subscription belongs to the barbershop and is processed by Stripe.'
                : 'A subscrição pertence à barbearia e é processada pela Stripe.'}
          </p>
        </div>
      </div>
    </section>
  );
}
