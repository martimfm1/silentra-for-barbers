'use client';

import Link from 'next/link';
import { ArrowRight, Check, Crown, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

type PlanKey = 'free' | 'pro' | 'enterprise';

type Plan = {
  key: PlanKey;
  name: string;
  price: string;
  description: string;
  featured?: boolean;
  features: string[];
};

type BillingContext = {
  plan: PlanKey;
  isBillingOwner: boolean;
};

export function LocalizedPricingSection() {
  const { locale } = useLanguage();
  const pt = locale === 'pt';
  const [billing, setBilling] = useState<BillingContext | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch('/api/stripe/subscription', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) return null;
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) return null;
        return {
          plan: (payload.plan === 'pro' || payload.plan === 'enterprise'
            ? payload.plan
            : 'free') as PlanKey,
          isBillingOwner: payload.isBillingOwner === true,
        } satisfies BillingContext;
      })
      .then((context) => {
        if (active) setBilling(context);
      })
      .catch(() => {
        if (active) setBilling(null);
      })
      .finally(() => {
        if (active) setBillingLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const plans: Plan[] = pt
    ? [
        {
          key: 'free',
          name: 'Barbers Free',
          price: '0 €',
          description:
            'O essencial para começar a receber reservas e organizar a operação.',
          features: [
            'Agendamentos ilimitados',
            'Clientes e serviços ilimitados',
            'Página pública da barbearia',
            'Reservas online',
            'Código QR da barbearia',
            'Agenda e disponibilidade',
            'Gestão básica de equipa',
          ],
        },
        {
          key: 'pro',
          name: 'Barbers Pro',
          price: '9,90 € / mês',
          description:
            'Para barbearias que querem crescer, fidelizar clientes e automatizar o dia a dia.',
          featured: true,
          features: [
            'Tudo do Free',
            'Até 5 barbeiros',
            'CRM e gestão de clientes',
            'Estatísticas avançadas',
            'Fidelização com pontos e recompensas',
            'Campanhas e automações',
            'Mensagens e emails automáticos',
            'Aniversários automáticos',
            'Seguimentos automáticos',
          ],
        },
        {
          key: 'enterprise',
          name: 'Barbers Enterprise',
          price: '29,99 € / mês',
          description:
            'Para operações maiores, várias localizações e controlo operacional avançado.',
          features: [
            'Tudo do Pro',
            'Barbeiros ilimitados',
            'Localizações ilimitadas',
            'POS, stock e comissões',
            'Permissões e gestão global',
            'Relatórios empresariais avançados',
            'Operação multi-localização',
            'Controlo centralizado',
          ],
        },
      ]
    : [
        {
          key: 'free',
          name: 'Barbers Free',
          price: '€0',
          description:
            'Everything you need to start taking bookings and organize your operation.',
          features: [
            'Unlimited bookings',
            'Unlimited customers and services',
            'Public barbershop page',
            'Online bookings',
            'Barbershop QR code',
            'Schedule and availability',
            'Basic team management',
          ],
        },
        {
          key: 'pro',
          name: 'Barbers Pro',
          price: '€9.90 / month',
          description:
            'For barbershops ready to grow, retain customers and automate daily operations.',
          featured: true,
          features: [
            'Everything in Free',
            'Up to 5 barbers',
            'CRM and customer management',
            'Advanced analytics',
            'Points and rewards loyalty',
            'Campaigns and automations',
            'Automated messages and emails',
            'Birthday automations',
            'Automated follow-ups',
          ],
        },
        {
          key: 'enterprise',
          name: 'Barbers Enterprise',
          price: '€29.99 / month',
          description:
            'For larger operations, multiple locations and advanced operational control.',
          features: [
            'Everything in Pro',
            'Unlimited barbers',
            'Unlimited locations',
            'POS, stock and commissions',
            'Global permissions and management',
            'Advanced business reports',
            'Multi-location operations',
            'Centralized control',
          ],
        },
      ];

  const eyebrow = pt ? 'Planos' : 'Plans';
  const title = pt
    ? 'Escolhe o plano certo para a tua operação.'
    : 'Choose the plan that fits your operation.';
  const subtitle = pt
    ? 'Começa grátis. Faz upgrade quando a tua barbearia precisar de mais controlo, automação e escala.'
    : 'Start free. Upgrade when your barbershop needs more control, automation and scale.';
  const trial = pt
    ? 'Oferta de lançamento: 1.º mês de Pro grátis com o cupão TRIALPRO'
    : 'Launch offer: 1st month of Pro free with coupon TRIALPRO';
  const trialDetails = pt
    ? 'Válido para novos utilizadores elegíveis. Sem compromisso.'
    : 'Valid for eligible new users. No commitment.';
  const compare = pt ? 'Comparar planos em detalhe' : 'Compare plans in detail';
  const included = pt ? 'Incluído' : 'Included';

  const ctaForPlan = useMemo(() => {
    return (plan: PlanKey) => {
      if (billingLoading) {
        return {
          label: '',
          href: '/plans',
          disabled: true,
        };
      }

      if (!billing) {
        return {
          label:
            plan === 'free'
              ? pt
                ? 'Começar grátis'
                : 'Start for free'
              : plan === 'pro'
                ? pt
                  ? 'Testar Pro grátis'
                  : 'Try Pro free'
                : pt
                  ? 'Escolher Enterprise'
                  : 'Choose Enterprise',
          href: plan === 'free' ? '/registo' : `/plans#${plan}`,
          disabled: false,
        };
      }

      if (billing.plan === plan) {
        return {
          label: pt ? 'Plano atual' : 'Current plan',
          href: '/dashboard/billing',
          disabled: true,
        };
      }

      if (!billing.isBillingOwner) {
        return {
          label: pt ? 'Ver planos' : 'View plans',
          href: '/plans',
          disabled: false,
        };
      }

      return {
        label:
          plan === 'free'
            ? pt
              ? 'Manter Free'
              : 'Keep Free'
            : plan === 'pro'
              ? billing.plan === 'enterprise'
                ? pt
                  ? 'Mudar para Pro'
                  : 'Switch to Pro'
                : pt
                  ? 'Testar Pro grátis'
                  : 'Try Pro free'
              : pt
                ? 'Fazer upgrade'
                : 'Upgrade',
        href: plan === 'free' ? '/dashboard/billing' : `/plans#${plan}`,
        disabled: false,
      };
    };
  }, [billing, billingLoading, pt]);

  return (
    <section id="planos" className="border-y border-white/8 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-sm leading-6 text-zinc-400 sm:text-base">
            {subtitle}
          </p>

          <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-left shadow-[0_20px_60px_rgba(16,185,129,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-emerald-100">
                    {trial}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-100/55">
                    {trialDetails}
                  </p>
                </div>
              </div>
              <Link
                href="/plans#pro"
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-100"
              >
                {pt ? 'Ver oferta' : 'View offer'}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          {plans.map((plan) => {
            const cta = ctaForPlan(plan.key);
            return (
              <article
                key={plan.name}
                className={`relative flex h-full flex-col rounded-2xl border p-6 transition ${plan.featured ? 'border-emerald-400/30 bg-emerald-400/[0.045] shadow-[0_30px_90px_rgba(16,185,129,0.08)]' : 'border-white/10 bg-white/[0.025]'}`}
              >
                {plan.featured && (
                  <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                    <Crown className="size-3" />
                    {pt ? 'Mais escolhido' : 'Most popular'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-white">
                    {plan.name}
                  </p>
                  <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {plan.price}
                  </p>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-400">
                    {plan.description}
                  </p>
                </div>
                <ul className="mt-6 flex-1 space-y-3 border-t border-white/8 pt-6">
                  {plan.features.map((feature, index) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-zinc-300"
                    >
                      <Check
                        className={`mt-0.5 size-4 shrink-0 ${index === 0 && plan.featured ? 'text-emerald-300' : 'text-zinc-500'}`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {cta.disabled ? (
                  <button
            aria-label="Escolher plano"
                    type="button"
                    disabled
                    className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-500 disabled:cursor-default"
                  >
                    {billingLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      cta.label
                    )}
                  </button>
                ) : (
                  <Link
                    href={cta.href}
                    className={`mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${plan.featured ? 'bg-white text-zinc-950 hover:bg-zinc-100' : 'border border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.07]'}`}
                  >
                    {cta.label}
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-sm font-semibold text-white">
              {pt ? 'Para começar' : 'Start simple'}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {pt
                ? 'O Free cobre a operação essencial sem cartão e sem obrigar a upgrade.'
                : 'Free covers the essential operation with no card and no forced upgrade.'}
            </p>
          </div>
          <Link
            href="/plans"
            className="group rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:border-white/20 hover:bg-white/[0.03]"
          >
            <p className="flex items-center justify-between text-sm font-semibold text-white">
              {compare}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {pt
                ? 'Vê limites, funcionalidades e detalhes de cada nível antes do checkout.'
                : 'See limits, features and full plan details before checkout.'}
            </p>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          {included}:{' '}
          {pt
            ? 'preços mensais apresentados para comparação. O checkout mostra sempre o preço configurado na Stripe.'
            : 'monthly pricing shown for comparison. Checkout always uses the price configured in Stripe.'}
        </p>
      </div>
    </section>
  );
}
