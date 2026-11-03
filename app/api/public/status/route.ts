import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import type {
  PublicStatusPayload,
  ServiceStatus,
  StatusComponent,
} from '@/lib/status/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function checkApi(request: Request): Promise<ServiceStatus> {
  const startedAt = performance.now();

  try {
    const healthUrl = new URL('/api/health', request.url);
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      return response.status >= 500 || response.status === 408
        ? 'major_outage'
        : 'unknown';
    }

    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('ok' in payload) ||
      payload.ok !== true ||
      !('service' in payload) ||
      payload.service !== 'silentra-for-barbers' ||
      !('status' in payload) ||
      payload.status !== 'healthy'
    ) {
      return 'unknown';
    }

    const durationMs = performance.now() - startedAt;
    return durationMs >= 2000 ? 'degraded' : 'operational';
  } catch {
    return 'major_outage';
  }
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

    // A credentials or schema error is not enough evidence to report an outage.
    return 'unknown';
  } catch {
    return 'major_outage';
  }
}

function getOverallStatus(
  apiStatus: ServiceStatus,
  databaseStatus: ServiceStatus,
): ServiceStatus {
  const statuses = [apiStatus, databaseStatus];

  if (statuses.includes('major_outage')) return 'major_outage';
  if (statuses.includes('maintenance')) return 'maintenance';
  if (
    statuses.includes('degraded') ||
    statuses.includes('partial_outage')
  ) {
    return 'degraded';
  }
  if (statuses.includes('unknown')) return 'unknown';

  return 'operational';
}

async function GET__unobserved(request: Request) {
  const [apiStatus, databaseStatus] = await Promise.all([
    checkApi(request),
    checkDatabase(),
  ]);

  const components: StatusComponent[] = [
    {
      id: 'api',
      name: 'APIs da Silentra',
      description:
        'Verificação da disponibilidade da camada de API através do endpoint interno de saúde.',
      status: apiStatus,
    },
    {
      id: 'database',
      name: 'Base de dados',
      description:
        'Consulta de leitura à base de dados principal, sem devolver registos públicos.',
      status: databaseStatus,
    },
  ];

  const payload: PublicStatusPayload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    overall: getOverallStatus(apiStatus, databaseStatus),
    components,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const GET = withApiObservability(
  '/api/public/status',
  GET__unobserved,
);
