'use client';

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Database,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  PublicStatusPayload,
  ServiceStatus,
  StatusComponent,
} from '@/lib/status/types';

type Locale = 'pt' | 'en';

const SERVICE_DETAILS: Record<
  'api' | 'database',
  { name: { pt: string; en: string }; icon: LucideIcon; description: { pt: string; en: string } }
> = {
  api: {
    name: { pt: 'APIs da Silentra', en: 'Silentra APIs' },
    icon: Activity,
    description: {
      pt: 'Disponibilidade da camada de API da plataforma.',
      en: 'Availability of the platform API layer.',
    },
  },
  database: {
    name: { pt: 'Base de dados', en: 'Database' },
    icon: Database,
    description: {
      pt: 'Ligação à base de dados principal da plataforma.',
      en: 'Connection to the platform primary database.',
    },
  },
};

const STATUS_STYLES: Record<
  ServiceStatus,
  { pt: string; en: string; className: string; icon: LucideIcon }
> = {
  operational: {
    pt: 'Operacional',
    en: 'Operational',
    className: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200',
    icon: CheckCircle2,
  },
  degraded: {
    pt: 'Desempenho reduzido',
    en: 'Degraded performance',
    className: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-200',
    icon: AlertTriangle,
  },
  partial_outage: {
    pt: 'Interrupção parcial',
    en: 'Partial outage',
    className: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-200',
    icon: AlertTriangle,
  },
  major_outage: {
    pt: 'Indisponível',
    en: 'Major outage',
    className: 'border-rose-400/20 bg-rose-400/[0.07] text-rose-200',
    icon: AlertCircle,
  },
  maintenance: {
    pt: 'Em manutenção',
    en: 'Under maintenance',
    className: 'border-sky-400/20 bg-sky-400/[0.07] text-sky-200',
    icon: CircleHelp,
  },
  unknown: {
    pt: 'Estado desconhecido',
    en: 'Status unavailable',
    className: 'border-white/10 bg-white/[0.04] text-zinc-300',
    icon: CircleHelp,
  },
};

function overallCopy(status: ServiceStatus, locale: Locale) {
  const copy: Record<ServiceStatus, { title: string; description: string }> = {
    operational: {
      title: locale === 'pt' ? 'Infraestrutura operacional.' : 'Infrastructure operational.',
      description:
        locale === 'pt'
          ? 'As APIs e a base de dados da Silentra estão a funcionar normalmente.'
          : 'Silentra APIs and the database are operating normally.',
    },
    degraded: {
      title: locale === 'pt' ? 'Desempenho reduzido.' : 'Degraded performance.',
      description:
        locale === 'pt'
          ? 'A infraestrutura está disponível, mas foi detetada uma resposta mais lenta.'
          : 'The infrastructure is available, but slower responses have been detected.',
    },
    partial_outage: {
      title: locale === 'pt' ? 'Interrupção parcial.' : 'Partial outage.',
      description:
        locale === 'pt'
          ? 'Uma parte da infraestrutura pode estar temporariamente afetada.'
          : 'Part of the infrastructure may be temporarily affected.',
    },
    major_outage: {
      title: locale === 'pt' ? 'Falha na infraestrutura.' : 'Infrastructure outage.',
      description:
        locale === 'pt'
          ? 'Foi detetada uma falha numa parte essencial da infraestrutura.'
          : 'A failure has been detected in a critical part of the infrastructure.',
    },
    maintenance: {
      title: locale === 'pt' ? 'Manutenção em curso.' : 'Maintenance in progress.',
      description:
        locale === 'pt'
          ? 'Alguns componentes podem ter disponibilidade limitada.'
          : 'Some components may have limited availability.',
    },
    unknown: {
      title: locale === 'pt' ? 'Estado não confirmado.' : 'Status not confirmed.',
      description:
        locale === 'pt'
          ? 'Não foi possível confirmar o estado de todos os componentes.'
          : 'The status of all components could not be confirmed.',
    },
  };

  return copy[status];
}

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-PT' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Lisbon',
  }).format(date);
}

function StatusBadge({
  status,
  locale,
}: {
  status: ServiceStatus;
  locale: Locale;
}) {
  const style = STATUS_STYLES[status];
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${style.className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {style[locale]}
    </span>
  );
}

function ServiceCard({
  component,
  locale,
}: {
  component: StatusComponent;
  locale: Locale;
}) {
  const service = SERVICE_DETAILS[component.id as 'api' | 'database'];
  const Icon = service?.icon ?? Activity;

  return (
    <article className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.035] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100">
              {service?.name[locale] ?? component.name}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {locale === 'pt' ? 'Infraestrutura própria' : 'Core infrastructure'}
            </p>
          </div>
        </div>
        <span
          className={
            component.status === 'operational'
              ? 'mt-1.5 size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]'
              : component.status === 'degraded' ||
                  component.status === 'partial_outage' ||
                  component.status === 'maintenance'
                ? 'mt-1.5 size-2 shrink-0 rounded-full bg-amber-400'
                : component.status === 'major_outage'
                  ? 'mt-1.5 size-2 shrink-0 rounded-full bg-rose-400'
                  : 'mt-1.5 size-2 shrink-0 rounded-full bg-zinc-500'
          }
          aria-hidden="true"
        />
      </div>

      <p className="min-h-10 text-sm leading-6 text-zinc-400">
        {service?.description[locale] ?? component.description}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
        <StatusBadge status={component.status} locale={locale} />
      </div>
    </article>
  );
}

export function StatusPageClient({ locale }: { locale: Locale }) {
  const [data, setData] = useState<PublicStatusPayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const response = await fetch('/api/public/status', {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error('Status request failed');

      const payload = (await response.json()) as PublicStatusPayload;
      if (
        payload?.ok !== true ||
        !Array.isArray(payload.components) ||
        payload.components.length !== 2 ||
        !payload.components.some((item) => item.id === 'api') ||
        !payload.components.some((item) => item.id === 'database') ||
        !payload.overall
      ) {
        throw new Error('Invalid status response');
      }

      setData(payload);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const overall = data
    ? overallCopy(data.overall, locale)
    : {
        title: locale === 'pt' ? 'A verificar a infraestrutura…' : 'Checking infrastructure…',
        description:
          locale === 'pt'
            ? 'Estamos a consultar o estado das APIs e da base de dados.'
            : 'Checking the status of the APIs and database.',
      };
  const updatedAt = data ? formatDate(data.generatedAt, locale) : null;
  const operationalCount =
    data?.components.filter((item) => item.status === 'operational').length ?? 0;

  return (
    <main className="min-h-screen overflow-x-clip bg-zinc-950 px-4 pb-16 pt-28 text-zinc-50 sm:px-6 sm:pt-32 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 border-b border-white/[0.08] pb-7 sm:mb-10 sm:pb-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
            Silentra for Barbers · {locale === 'pt' ? 'Infraestrutura' : 'Infrastructure'}
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl lg:text-5xl">
                {locale === 'pt' ? 'Estado da infraestrutura' : 'Infrastructure status'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {locale === 'pt'
                  ? 'Acompanha apenas os dois componentes centrais da plataforma: APIs e base de dados.'
                  : 'Monitor the two core platform components: APIs and database.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {locale === 'pt' ? 'Atualizar estado' : 'Refresh status'}
            </button>
          </div>
        </header>

        <section
          aria-live="polite"
          aria-atomic="true"
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.09),transparent_42%),rgba(24,24,27,0.72)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.2)] sm:p-7 lg:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span
                className={
                  !data
                    ? 'flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300'
                    : data.overall === 'operational'
                      ? 'flex size-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200'
                      : data.overall === 'major_outage'
                        ? 'flex size-12 shrink-0 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] text-rose-200'
                        : 'flex size-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] text-amber-200'
                }
              >
                {data?.overall === 'operational' ? (
                  <ShieldCheck className="size-6" aria-hidden="true" />
                ) : data?.overall === 'major_outage' ? (
                  <AlertCircle className="size-6" aria-hidden="true" />
                ) : data ? (
                  <AlertTriangle className="size-6" aria-hidden="true" />
                ) : (
                  <Activity className="size-6" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">
                  {overall.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  {overall.description}
                </p>
                {updatedAt ? (
                  <p className="mt-3 text-xs text-zinc-500">
                    {locale === 'pt' ? 'Última atualização:' : 'Last updated:'}{' '}
                    <time dateTime={data?.generatedAt}>{updatedAt}</time>
                  </p>
                ) : null}
              </div>
            </div>

            {data ? (
              <div className="shrink-0 border-t border-white/[0.08] pt-4 text-left sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right">
                <p className="text-2xl font-semibold tabular-nums text-white">
                  {operationalCount}
                  <span className="ml-1 text-sm font-normal text-zinc-500">
                    / 2
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {locale === 'pt'
                    ? 'componentes operacionais'
                    : 'operational components'}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-100"
          >
            {locale === 'pt'
              ? 'Não foi possível atualizar o estado. Vamos tentar novamente automaticamente.'
              : 'Status could not be refreshed. We will try again automatically.'}
          </p>
        ) : null}

        <section className="mt-10 sm:mt-12">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {locale === 'pt' ? 'Infraestrutura' : 'Infrastructure'}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">
                {locale === 'pt' ? 'Componentes monitorizados' : 'Monitored components'}
              </h2>
            </div>
            <p className="text-xs text-zinc-500">
              {locale === 'pt'
                ? 'Atualização automática a cada 60 segundos'
                : 'Automatically refreshed every 60 seconds'}
            </p>
          </div>

          {data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.components.map((component) => (
                <ServiceCard
                  component={component}
                  locale={locale}
                  key={component.id}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.025]"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 border-t border-white/[0.07] pt-5 text-xs leading-5 text-zinc-500">
          {locale === 'pt'
            ? 'A API é verificada através de um endpoint interno de saúde. A base de dados é testada com uma consulta de leitura; nenhum registo ou dado de clientes é exposto nesta página.'
            : 'The API is checked through an internal health endpoint. The database is tested with a read-only query; no customer records or data are exposed on this page.'}
        </div>
      </div>
    </main>
  );
}
