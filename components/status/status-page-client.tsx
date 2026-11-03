'use client';

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  Database,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  PublicStatusPayload,
  ServiceStatus,
  StatusComponent,
} from '@/lib/status/types';

type Locale = 'pt' | 'en';

const SERVICE_ICONS: Record<string, LucideIcon> = {
  application: Activity,
  database: Database,
  supabase: Database,
  vercel: Server,
  stripe: CreditCard,
  brevo: Mail,
};

const SERVICE_NAMES: Record<string, { pt: string; en: string }> = {
  application: { pt: 'Aplicação e API pública', en: 'Application and public API' },
  database: { pt: 'Base de dados', en: 'Database' },
  supabase: { pt: 'Supabase', en: 'Supabase' },
  vercel: { pt: 'Vercel', en: 'Vercel' },
  stripe: { pt: 'Stripe', en: 'Stripe' },
  brevo: { pt: 'Brevo', en: 'Brevo' },
};

const ENGLISH_DESCRIPTIONS: Record<string, string> = {
  application: 'The server responded to the platform status request.',
  database: 'Read-only connectivity check against the platform database.',
  supabase: 'Public status published by the infrastructure provider.',
  vercel: 'Public status published by the hosting provider.',
  stripe: 'Public status published by the payments provider.',
  brevo: 'Public status published by the email provider.',
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
    icon: TriangleAlert,
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
    icon: CalendarClock,
  },
  unknown: {
    pt: 'Estado desconhecido',
    en: 'Status unavailable',
    className: 'border-white/10 bg-white/[0.04] text-zinc-300',
    icon: CircleHelp,
  },
};

function overallCopy(status: ServiceStatus, locale: Locale) {
  const copy: Record<
    ServiceStatus,
    { title: string; description: string }
  > = {
    operational: {
      title: locale === 'pt' ? 'Tudo a funcionar.' : 'All systems operational.',
      description:
        locale === 'pt'
          ? 'Os serviços monitorizados estão a funcionar normalmente.'
          : 'The monitored services are operating normally.',
    },
    degraded: {
      title:
        locale === 'pt'
          ? 'Alguns serviços estão mais lentos.'
          : 'Some services are experiencing degraded performance.',
      description:
        locale === 'pt'
          ? 'A plataforma continua disponível, mas alguns serviços podem estar mais lentos.'
          : 'The platform remains available, but some services may be slower than usual.',
    },
    partial_outage: {
      title:
        locale === 'pt'
          ? 'Foi detetada uma interrupção parcial.'
          : 'A partial service outage has been detected.',
      description:
        locale === 'pt'
          ? 'Uma dependência pode estar a afetar parte da experiência.'
          : 'A dependency may be affecting part of the experience.',
    },
    major_outage: {
      title:
        locale === 'pt'
          ? 'Um serviço essencial está indisponível.'
          : 'A critical service is unavailable.',
      description:
        locale === 'pt'
          ? 'Estamos a detetar uma falha num serviço essencial da plataforma.'
          : 'A failure has been detected in a critical platform service.',
    },
    maintenance: {
      title:
        locale === 'pt'
          ? 'Existe uma manutenção em curso.'
          : 'Scheduled maintenance is in progress.',
      description:
        locale === 'pt'
          ? 'Alguns serviços podem ter disponibilidade limitada durante este período.'
          : 'Some services may have limited availability during this period.',
    },
    unknown: {
      title:
        locale === 'pt'
          ? 'Não foi possível confirmar todos os serviços.'
          : 'Some service statuses could not be verified.',
      description:
        locale === 'pt'
          ? 'A página está disponível, mas uma ou mais fontes de estado não responderam.'
          : 'This page is available, but one or more status sources did not respond.',
    },
  };

  return copy[status];
}

function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return null;
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
  const Icon = SERVICE_ICONS[component.id] ?? ShieldCheck;
  const serviceName =
    SERVICE_NAMES[component.id]?.[locale] ?? component.name;
  const description =
    locale === 'pt'
      ? component.description
      : ENGLISH_DESCRIPTIONS[component.id] ??
        'Status published by the service provider.';

  return (
    <article className="flex min-w-0 flex-col justify-between gap-5 rounded-2xl border border-white/[0.09] bg-white/[0.025] p-5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.035] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-zinc-100">
              {serviceName}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {locale === 'pt' ? 'Componente monitorizado' : 'Monitored component'}
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

      <p className="min-h-10 text-sm leading-6 text-zinc-400">{description}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
        <StatusBadge status={component.status} locale={locale} />
        {component.sourceUrl ? (
          <a
            href={component.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:text-zinc-100"
          >
            {locale === 'pt' ? 'Estado oficial' : 'Official status'}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
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
        title:
          locale === 'pt' ? 'A consultar os serviços…' : 'Checking services…',
        description:
          locale === 'pt'
            ? 'Estamos a obter o estado mais recente da plataforma.'
            : 'Fetching the latest platform status.',
      };
  const updatedAt = data ? formatDate(data.generatedAt, locale) : null;
  const operationalCount =
    data?.components.filter((item) => item.status === 'operational').length ?? 0;

  return (
    <main className="min-h-screen overflow-x-clip bg-zinc-950 px-4 pb-16 pt-28 text-zinc-50 sm:px-6 sm:pt-32 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 border-b border-white/[0.08] pb-7 sm:mb-10 sm:pb-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
            {locale === 'pt' ? 'Silentra for Barbers · Estado da plataforma' : 'Silentra for Barbers · Platform status'}
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-[-0.055em] text-white sm:text-4xl lg:text-5xl">
                {locale === 'pt' ? 'Status da plataforma' : 'Platform status'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {locale === 'pt'
                  ? 'Acompanha a disponibilidade da aplicação, da base de dados e dos serviços externos de que dependemos.'
                  : 'Track the availability of the application, database and the external services we rely on.'}
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
                    / {data.components.length}
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
              ? 'Não foi possível atualizar todos os dados. Vamos tentar novamente automaticamente.'
              : 'Some status data could not be refreshed. We will try again automatically.'}
          </p>
        ) : null}

        <section className="mt-10 sm:mt-12">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {locale === 'pt' ? 'Serviços' : 'Services'}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">
                {locale === 'pt' ? 'Estado dos componentes' : 'Component status'}
              </h2>
            </div>
            <p className="text-xs text-zinc-500">
              {locale === 'pt'
                ? 'Atualização automática a cada 60 segundos'
                : 'Automatically refreshed every 60 seconds'}
            </p>
          </div>

          {data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.components.map((component) => (
                <ServiceCard
                  component={component}
                  locale={locale}
                  key={component.id}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.025]"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-5 lg:mt-12 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {locale === 'pt' ? 'Incidentes ativos' : 'Active incidents'}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {locale === 'pt'
                    ? 'Comunicados pelos fornecedores monitorizados'
                    : 'Reported by monitored service providers'}
                </p>
              </div>
            </div>

            {data?.incidents.length ? (
              <div className="mt-5 divide-y divide-white/[0.07]">
                {data.incidents.map((incident) => (
                  <article className="py-4 first:pt-0 last:pb-0" key={incident.id}>
                    <p className="text-xs font-medium text-zinc-500">
                      {incident.provider}
                    </p>
                    <h3 className="mt-1 text-sm font-medium text-zinc-200">
                      {incident.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs capitalize text-amber-200">
                        {incident.status.replaceAll('_', ' ')}
                      </span>
                      <a
                        href={incident.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-8 items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200"
                      >
                        {locale === 'pt' ? 'Ver atualização' : 'View update'}
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-zinc-400">
                {data
                  ? locale === 'pt'
                    ? 'Não existem incidentes ativos comunicados pelos fornecedores monitorizados.'
                    : 'No active incidents have been reported by the monitored providers.'
                  : locale === 'pt'
                    ? 'Os incidentes serão apresentados assim que o estado estiver disponível.'
                    : 'Incidents will appear once status data is available.'}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300">
                <CalendarClock className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {locale === 'pt'
                    ? 'Manutenções programadas'
                    : 'Scheduled maintenance'}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {locale === 'pt'
                    ? 'Janelas anunciadas pelos fornecedores'
                    : 'Maintenance windows announced by providers'}
                </p>
              </div>
            </div>

            {data?.maintenances.length ? (
              <div className="mt-5 divide-y divide-white/[0.07]">
                {data.maintenances.map((maintenance) => (
                  <article
                    className="py-4 first:pt-0 last:pb-0"
                    key={maintenance.id}
                  >
                    <p className="text-xs font-medium text-zinc-500">
                      {maintenance.provider}
                    </p>
                    <h3 className="mt-1 text-sm font-medium text-zinc-200">
                      {maintenance.title}
                    </h3>
                    <p className="mt-2 text-xs text-zinc-500">
                      {maintenance.scheduledFor
                        ? formatDate(maintenance.scheduledFor, locale)
                        : locale === 'pt'
                          ? 'Data a confirmar'
                          : 'Date to be confirmed'}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-zinc-400">
                {data
                  ? locale === 'pt'
                    ? 'Não existem manutenções programadas comunicadas pelos fornecedores.'
                    : 'No scheduled maintenance has been announced by the providers.'
                  : locale === 'pt'
                    ? 'As manutenções serão apresentadas assim que o estado estiver disponível.'
                    : 'Maintenance windows will appear once status data is available.'}
              </p>
            )}
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.07] pt-5 text-xs leading-5 text-zinc-500 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl">
            {locale === 'pt'
              ? 'Os estados dos fornecedores são obtidos a partir das respetivas páginas oficiais. Uma indicação operacional do fornecedor não substitui uma verificação completa de cada integração ou conta.'
              : 'Provider statuses are retrieved from their respective official status pages. A provider reporting operational status does not replace a full check of every integration or account.'}
          </p>
          <p className="shrink-0">
            {locale === 'pt'
              ? 'Silentra for Barbers · 2026'
              : 'Silentra for Barbers · 2026'}
          </p>
        </div>
      </div>
    </main>
  );
}
