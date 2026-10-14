'use client';

import { Check, Minus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import {
  FEATURE_LABELS,
  hasPlanFeature,
  PLAN_NAMES,
  PLAN_LIMITS,
  type EnterpriseFeatureKey,
  type FreeFeatureKey,
  type ProFeatureKey,
} from '@/lib/billing/plan-features';
import { PLANS, type BillingPlan } from '@/lib/stripe/constants';

type ComparisonFeatureKey =
  FreeFeatureKey | ProFeatureKey | EnterpriseFeatureKey;
const PLAN_ORDER: readonly BillingPlan[] = [
  PLANS.FREE,
  PLANS.PRO,
  PLANS.ENTERPRISE,
];
const FEATURE_GROUPS: ReadonlyArray<{
  title: string;
  features: readonly ComparisonFeatureKey[];
}> = [
  {
    title: 'Gestão da barbearia',
    features: [
      'agenda',
      'appointments',
      'clients',
      'services',
      'online_booking',
      'booking_page',
      'qr_booking',
      'basic_dashboard',
      'basic_revenue',
      'basic_client_history',
    ],
  },
  {
    title: 'Comunicação e automação',
    features: [
      'messaging',
      'basic_notifications',
      'automated_reminders',
      'automated_followups',
      'advanced_notifications',
      'marketing_campaigns',
    ],
  },
  {
    title: 'Crescimento e clientes',
    features: ['advanced_crm', 'customer_segments', 'loyalty'],
  },
  {
    title: 'Analytics e relatórios',
    features: ['advanced_analytics', 'advanced_reports', 'enterprise_reports'],
  },
  {
    title: 'Equipa e operação',
    features: [
      'team_management',
      'multi_location',
      'global_dashboard',
      'advanced_permissions',
      'commissions',
      'inventory',
      'pos',
    ],
  },
  {
    title: 'Presença online',
    features: ['landing_page'],
  },
];

function formatLimit(value: number, singular: string, plural: string) {
  return Number.isFinite(value)
    ? `${value} ${value === 1 ? singular : plural}`
    : 'Ilimitado';
}

function PlanBadge({
  plan,
  active,
  popular,
}: {
  plan: BillingPlan;
  active: boolean;
  popular: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p
          className={`text-sm font-semibold ${plan === PLANS.PRO ? 'text-emerald-300' : 'text-zinc-100'}`}
        >
          {PLAN_NAMES[plan]}
        </p>
        {active ? (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            Plano atual
          </p>
        ) : popular ? (
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-emerald-400/70">
            Mais popular
          </p>
        ) : null}
      </div>
      {active ? (
        <ShieldCheck
          className="size-4 shrink-0 text-emerald-400"
          aria-label="Plano atual"
        />
      ) : null}
    </div>
  );
}

export function PlanComparison() {
  const { plan: currentPlan, isAuthenticated, loading } = useSubscription();
  const [mobilePlan, setMobilePlan] = useState<BillingPlan>(PLANS.PRO);

  return (
    <section className="mt-16" aria-labelledby="comparison-title">
      <div className="mb-7 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.34em] text-zinc-500">
          Comparação completa
        </p>
        <h2
          id="comparison-title"
          className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-zinc-50 sm:text-4xl"
        >
          Compara todas as funcionalidades.
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400 sm:text-base">
          O Free já inclui tudo o que precisas para começar. Os planos pagos
          acrescentam ferramentas para crescer, automatizar e gerir operações
          maiores.
        </p>
      </div>

      <div className="md:hidden">
        <div className="sticky top-16 z-20 -mx-1 rounded-2xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-[0_12px_35px_rgba(0,0,0,0.32)] backdrop-blur-md">
          <div className="grid grid-cols-3 gap-1">
            {PLAN_ORDER.map((item) => {
              const active =
                isAuthenticated && !loading && currentPlan === item;
              const selected = mobilePlan === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMobilePlan(item)}
                  className={`min-h-11 rounded-xl px-2 py-2 text-center transition ${selected ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-100'}`}
                  aria-pressed={selected}
                >
                  <span className="block text-xs font-semibold">
                    {PLAN_NAMES[item]}
                  </span>
                  {active ? (
                    <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                      Atual
                    </span>
                  ) : item === PLANS.PRO ? (
                    <span
                      className={`mt-0.5 block text-[9px] font-medium uppercase tracking-wider ${selected ? 'text-emerald-700' : 'text-emerald-400/70'}`}
                    >
                      Popular
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.18)]">
            <PlanBadge
              plan={mobilePlan}
              active={isAuthenticated && !loading && currentPlan === mobilePlan}
              popular={mobilePlan === PLANS.PRO}
            />
            <div className="glassmorphism mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[11px] text-zinc-500">Profissionais</p>
                <p className="mt-1 font-semibold text-zinc-100">
                  {formatLimit(
                    PLAN_LIMITS[mobilePlan].barbers,
                    'barbeiro',
                    'barbeiros',
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <p className="text-[11px] text-zinc-500">Localizações</p>
                <p className="mt-1 font-semibold text-zinc-100">
                  {formatLimit(
                    PLAN_LIMITS[mobilePlan].locations,
                    'localização',
                    'localizações',
                  )}
                </p>
              </div>
            </div>
          </div>

          {FEATURE_GROUPS.map((group) => (
            <section
              key={group.title}
              className="glassmorphism rounded-2xl border border-white/10 bg-zinc-900/45"
            >
              <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {group.title}
                </h3>
              </div>
              <div className="divide-y divide-white/5">
                {group.features.map((feature) => {
                  const included = hasPlanFeature(mobilePlan, feature);
                  return (
                    <div
                      key={feature}
                      className="flex items-center justify-between gap-4 px-4 py-3.5"
                    >
                      <span className="min-w-0 text-sm leading-5 text-zinc-300">
                        {FEATURE_LABELS[feature]}
                      </span>
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/5 bg-white/[0.02]">
                        {included ? (
                          <Check
                            className="size-4 text-emerald-400"
                            aria-hidden="true"
                          />
                        ) : (
                          <Minus
                            className="size-4 text-zinc-700"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <p className="px-1 pt-1 text-xs leading-5 text-zinc-600">
            Todas as funcionalidades de um plano inferior ficam incluídas nos
            planos superiores. Os limites são aplicados no servidor.
          </p>
        </div>
      </div>

      <div className="hidden md:block overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th
                  scope="col"
                  className="w-[44%] px-5 py-5 text-sm font-medium text-zinc-400 sm:px-7"
                >
                  Funcionalidade
                </th>
                {PLAN_ORDER.map((item) => {
                  const active =
                    isAuthenticated && !loading && currentPlan === item;
                  return (
                    <th
                      key={item}
                      scope="col"
                      className={`px-4 py-5 text-center text-sm font-semibold sm:px-6 ${active ? 'bg-emerald-500/[0.07]' : ''}`}
                    >
                      <PlanBadge
                        plan={item}
                        active={active}
                        popular={item === PLANS.PRO && !active}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th
                  scope="row"
                  className="px-5 py-4 text-sm font-semibold text-zinc-200 sm:px-7"
                >
                  Limite de profissionais
                </th>
                {PLAN_ORDER.map((item) => (
                  <td
                    key={item}
                    className={`px-4 py-4 text-center text-sm text-zinc-300 sm:px-6 ${currentPlan === item && isAuthenticated ? 'bg-emerald-500/[0.04]' : ''}`}
                  >
                    {formatLimit(
                      PLAN_LIMITS[item].barbers,
                      'barbeiro',
                      'barbeiros',
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th
                  scope="row"
                  className="px-5 py-4 text-sm font-semibold text-zinc-200 sm:px-7"
                >
                  Localizações
                </th>
                {PLAN_ORDER.map((item) => (
                  <td
                    key={item}
                    className={`px-4 py-4 text-center text-sm text-zinc-300 sm:px-6 ${currentPlan === item && isAuthenticated ? 'bg-emerald-500/[0.04]' : ''}`}
                  >
                    {formatLimit(
                      PLAN_LIMITS[item].locations,
                      'localização',
                      'localizações',
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
            {FEATURE_GROUPS.map((group) => (
              <tbody key={group.title}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={4}
                    className="border-y border-white/10 bg-zinc-950/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:px-7"
                  >
                    {group.title}
                  </th>
                </tr>
                {group.features.map((feature) => (
                  <tr
                    key={feature}
                    className="border-b border-white/5 last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-5 py-4 text-sm font-normal text-zinc-300 sm:px-7"
                    >
                      {FEATURE_LABELS[feature]}
                    </th>
                    {PLAN_ORDER.map((item) => {
                      const included = hasPlanFeature(item, feature);
                      const active = currentPlan === item && isAuthenticated;
                      return (
                        <td
                          key={item}
                          className={`px-4 py-4 text-center sm:px-6 ${active ? 'bg-emerald-500/[0.04]' : ''}`}
                        >
                          {included ? (
                            <span
                              className="inline-flex size-6 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              aria-label={`${FEATURE_LABELS[feature]} incluído`}
                            >
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex size-6 items-center justify-center text-zinc-700"
                              aria-label={`${FEATURE_LABELS[feature]} não incluído`}
                            >
                              <Minus className="size-4" aria-hidden="true" />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="border-t border-white/10 px-5 py-4 text-xs leading-5 text-zinc-500 sm:px-7">
          Todas as funcionalidades de um plano inferior ficam incluídas nos
          planos superiores. Os limites são aplicados no servidor.
        </p>
      </div>
    </section>
  );
}
