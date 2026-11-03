import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import type {
  PublicStatusPayload,
  ServiceStatus,
  StatusComponent,
  StatusIncident,
  StatusMaintenance,
} from '@/lib/status/types';

export const runtime = 'nodejs';
export const revalidate = 60;

type ProviderConfig = {
  id: 'supabase' | 'vercel' | 'stripe' | 'brevo';
  name: string;
  description: string;
  summaryUrl: string;
  statusUrl: string;
};

type ProviderResult = {
  component: StatusComponent;
  incidents: StatusIncident[];
  maintenances: StatusMaintenance[];
};

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Infraestrutura de base de dados e autenticação.',
    summaryUrl: 'https://status.supabase.com/api/v2/summary.json',
    statusUrl: 'https://status.supabase.com/',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Alojamento e infraestrutura de distribuição da aplicação.',
    summaryUrl: 'https://www.vercel-status.com/api/v2/summary.json',
    statusUrl: 'https://www.vercel-status.com/',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Processamento de pagamentos e faturação.',
    summaryUrl: 'https://status.stripe.com/api/v2/summary.json',
    statusUrl: 'https://status.stripe.com/',
  },
  {
    id: 'brevo',
    name: 'Brevo',
    description: 'Email transacional e notificações por email.',
    summaryUrl: 'https://status.brevo.com/api/v2/summary.json',
    statusUrl: 'https://status.brevo.com/',
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeText(value: unknown, maxLength = 180): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function mapIndicator(value: unknown): ServiceStatus {
  const indicator = safeText(value, 40).toLowerCase();

  if (indicator === 'none' || indicator === 'operational' || indicator === 'up')
    return 'operational';
  if (indicator === 'minor' || indicator === 'degraded')
    return 'degraded';
  if (indicator === 'maintenance' || indicator === 'under_maintenance')
    return 'maintenance';
  if (indicator === 'major' || indicator === 'critical')
    return 'major_outage';
  if (indicator === 'partial_outage') return 'partial_outage';

  return 'unknown';
}

function mapOverallStatus(
  components: StatusComponent[],
): ServiceStatus {
  const application = components.find((item) => item.id === 'application');
  const database = components.find((item) => item.id === 'database');

  if (
    application?.status === 'major_outage' ||
    database?.status === 'major_outage'
  ) {
    return 'major_outage';
  }

  const providerStatuses = components
    .filter((item) => item.id !== 'application' && item.id !== 'database')
    .map((item) => item.status);

  if (providerStatuses.includes('major_outage') || providerStatuses.includes('partial_outage'))
    return 'partial_outage';
  if (providerStatuses.includes('degraded')) return 'degraded';
  if (
    components.some((item) => item.status === 'maintenance')
  ) {
    return 'maintenance';
  }
  if (components.some((item) => item.status === 'unknown')) return 'unknown';

  return 'operational';
}

async function checkDatabase(): Promise<ServiceStatus> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return 'unknown';

  try {
    const endpoint = new URL('/rest/v1/barbershops', supabaseUrl);
    endpoint.searchParams.set('select', 'id');
    endpoint.searchParams.set('limit', '1');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });

    if (response.ok) return 'operational';
    if (response.status >= 500 || response.status === 408)
      return 'major_outage';

    // Authentication/configuration or schema errors are not proof of an outage.
    return 'unknown';
  } catch {
    return 'major_outage';
  }
}

async function fetchProviderStatus(
  provider: ProviderConfig,
): Promise<ProviderResult> {
  const component: StatusComponent = {
    id: provider.id,
    name: provider.name,
    description: provider.description,
    status: 'unknown',
    sourceUrl: provider.statusUrl,
    sourceUpdatedAt: null,
  };

  try {
    const response = await fetch(provider.summaryUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      return { component, incidents: [], maintenances: [] };
    }

    const payload = asRecord(await response.json());
    if (!payload) return { component, incidents: [], maintenances: [] };

    const providerStatus = asRecord(payload.status);
    const page = asRecord(payload.page);
    component.status = mapIndicator(providerStatus?.indicator);
    component.sourceUpdatedAt =
      safeText(page?.updated_at, 80) || null;

    const incidents: StatusIncident[] = Array.isArray(payload.incidents)
      ? payload.incidents
          .map((entry, index) => {
            const incident = asRecord(entry);
            if (!incident) return null;
            const status = safeText(incident.status, 40);
            if (!status || status.toLowerCase() === 'resolved') return null;

            return {
              id: `${provider.id}-${safeText(incident.id, 80) || index}`,
              provider: provider.name,
              title: safeText(incident.name, 180) || 'Incidente comunicado',
              status,
              impact: safeText(incident.impact, 40) || 'unknown',
              updatedAt: safeText(incident.updated_at, 80) || null,
              sourceUrl: provider.statusUrl,
            };
          })
          .filter((item): item is StatusIncident => item !== null)
          .slice(0, 5)
      : [];

    const maintenances: StatusMaintenance[] = Array.isArray(
      payload.scheduled_maintenances,
    )
      ? payload.scheduled_maintenances
          .map((entry, index) => {
            const maintenance = asRecord(entry);
            if (!maintenance) return null;
            const status = safeText(maintenance.status, 40);
            if (
              !status ||
              ['completed', 'cancelled', 'canceled'].includes(
                status.toLowerCase(),
              )
            ) {
              return null;
            }

            return {
              id: `${provider.id}-maintenance-${safeText(maintenance.id, 80) || index}`,
              provider: provider.name,
              title:
                safeText(maintenance.name, 180) || 'Manutenção programada',
              status,
              scheduledFor:
                safeText(maintenance.scheduled_for, 80) ||
                safeText(maintenance.scheduled_for_date, 80) ||
                null,
              scheduledUntil:
                safeText(maintenance.scheduled_until, 80) ||
                safeText(maintenance.scheduled_until_date, 80) ||
                null,
              sourceUrl: provider.statusUrl,
            };
          })
          .filter((item): item is StatusMaintenance => item !== null)
          .slice(0, 5)
      : [];

    return { component, incidents, maintenances };
  } catch {
    return { component, incidents: [], maintenances: [] };
  }
}

async function GET__unobserved() {
  const [databaseStatus, providerResults] = await Promise.all([
    checkDatabase(),
    Promise.all(PROVIDERS.map(fetchProviderStatus)),
  ]);

  const components: StatusComponent[] = [
    {
      id: 'application',
      name: 'Aplicação e API pública',
      description:
        'O servidor respondeu ao pedido de estado da plataforma.',
      status: 'operational',
    },
    {
      id: 'database',
      name: 'Base de dados',
      description:
        'Verificação de leitura à base de dados utilizada pela plataforma.',
      status: databaseStatus,
      sourceUrl: 'https://status.supabase.com/',
    },
    ...providerResults.map((result) => result.component),
  ];

  const incidents = providerResults.flatMap((result) => result.incidents);
  const maintenances = providerResults.flatMap(
    (result) => result.maintenances,
  );

  const payload: PublicStatusPayload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    overall: mapOverallStatus(components),
    components,
    incidents: incidents.slice(0, 12),
    maintenances: maintenances.slice(0, 8),
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const GET = withApiObservability(
  '/api/public/status',
  GET__unobserved,
);
