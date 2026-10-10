import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';
import { withApiObservability } from '@/lib/observability/api';
import { productionLogger } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CheckResult = {
  id: string;
  label: string;
  ok: boolean;
  status: 'healthy' | 'degraded' | 'not_configured' | 'failed';
  durationMs: number;
  detail: string | null;
  critical: boolean;
};
type ApiLogRow = {
  id: string;
  request_id: string;
  route: string;
  method: string;
  status_code: number;
  duration_ms: number;
  level: 'info' | 'warn' | 'error';
  error_code: string | null;
  environment: string;
  region: string | null;
  created_at: string;
};

function safeProviderDetail(status: number) {
  if (status >= 200 && status < 300)
    return `Ligação verificada (HTTP ${status}).`;
  if (status === 401 || status === 403)
    return 'Credencial rejeitada pelo fornecedor.';
  if (status === 429) return 'Limite de pedidos do fornecedor atingido.';
  return `Fornecedor respondeu com HTTP ${status}.`;
}
async function timedCheck(
  id: string,
  label: string,
  critical: boolean,
  check: () => Promise<{
    ok: boolean;
    detail?: string;
    status?: CheckResult['status'];
  }>,
): Promise<CheckResult> {
  const startedAt = performance.now();
  try {
    const value = await check();
    return {
      id,
      label,
      ok: value.ok,
      status: value.status ?? (value.ok ? 'healthy' : 'failed'),
      durationMs: Math.round(performance.now() - startedAt),
      detail: value.detail ?? null,
      critical,
    };
  } catch {
    return {
      id,
      label,
      ok: false,
      status: 'failed',
      durationMs: Math.round(performance.now() - startedAt),
      detail: 'O teste falhou; verifica os logs do serviço.',
      critical,
    };
  }
}
async function providerCheck(
  provider: 'stripe' | 'brevo',
  key: string | undefined,
) {
  if (!key)
    return {
      ok: false,
      status: 'not_configured' as const,
      detail: `${provider === 'stripe' ? 'Stripe' : 'Brevo'} não está configurado no ambiente.`,
    };
  const url =
    provider === 'stripe'
      ? 'https://api.stripe.com/v1/account'
      : 'https://api.brevo.com/v3/account';
  const headers: Record<string, string> =
    provider === 'stripe'
      ? { Authorization: `Bearer ${key}` }
      : { 'api-key': key };
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(4500),
    });
    return {
      ok: response.ok,
      status: response.ok ? ('healthy' as const) : ('failed' as const),
      detail: safeProviderDetail(response.status),
    };
  } catch {
    return {
      ok: false,
      status: 'failed' as const,
      detail: 'Sem resposta do fornecedor dentro do tempo limite.',
    };
  }
}
function percentile(values: number[], percent: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(percent * sorted.length) - 1)
  ];
}

async function GET_unobserved(_request: Request) {
  try {
    const { admin } = await requirePlatformAdmin();
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const paymentModeResult = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'payment_mode')
      .maybeSingle();
    const paymentMode =
      paymentModeResult.data?.value === 'STRIPE' ? 'STRIPE' : 'MANUAL';

    const [
      databaseCheck,
      telemetryCheck,
      shopsCheck,
      usersCheck,
      appointmentsCheck,
      subscriptionsCheck,
      auditCheck,
      stripeCheck,
      emailCheck,
    ] = await Promise.all([
      timedCheck('database', 'Base de dados Supabase', true, async () => {
        const { error } = await admin
          .from('barbershops')
          .select('id', { head: true, count: 'exact' });
        return {
          ok: !error,
          detail: error
            ? 'Falha de consulta à base de dados.'
            : 'Ligação à base de dados confirmada.',
        };
      }),
      timedCheck('telemetry', 'Registo de pedidos API', false, async () => {
        const { error } = await admin
          .from('platform_api_logs')
          .select('id', { head: true, count: 'exact' });
        return {
          ok: !error,
          detail: error
            ? 'Tabela de telemetria ausente ou inacessível; aplica a migração da plataforma.'
            : 'Tabela de logs acessível.',
        };
      }),
      timedCheck('barbershops', 'Dados de barbearias', true, async () => {
        const { error } = await admin
          .from('barbershops')
          .select('id', { head: true, count: 'exact' });
        return {
          ok: !error,
          detail: error
            ? 'Consulta da tabela de barbearias falhou.'
            : 'Tabela disponível.',
        };
      }),
      timedCheck('users', 'Utilizadores e permissões', true, async () => {
        const { error } = await admin
          .from('users')
          .select('id', { head: true, count: 'exact' });
        return {
          ok: !error,
          detail: error
            ? 'Consulta de utilizadores falhou.'
            : 'Tabela disponível.',
        };
      }),
      timedCheck('appointments', 'Marcações', true, async () => {
        const { error } = await admin
          .from('appointments')
          .select('id', { head: true, count: 'exact' });
        return {
          ok: !error,
          detail: error
            ? 'Consulta de marcações falhou.'
            : 'Tabela disponível.',
        };
      }),
      timedCheck('subscriptions', 'Subscrições e planos', true, async () => {
        const { error } = await admin
          .from('subscriptions')
          .select('id', { head: true, count: 'exact' });
        return {
          ok: !error,
          detail: error
            ? 'Consulta de subscrições falhou.'
            : 'Tabela disponível.',
        };
      }),
      timedCheck('audit_logs', 'Auditoria administrativa', true, async () => {
        const { error } = await admin
          .from('audit_logs')
          .select('id', { head: true, count: 'exact' });
        return {
          ok: !error,
          detail: error
            ? 'Consulta de auditoria falhou.'
            : 'Tabela disponível.',
        };
      }),
      timedCheck(
        'stripe',
        'Stripe (API externa)',
        paymentMode === 'STRIPE',
        async () => {
          const result = await providerCheck(
            'stripe',
            process.env.STRIPE_SECRET_KEY,
          );
          return {
            ok:
              result.ok ||
              (result.status === 'not_configured' && paymentMode !== 'STRIPE'),
            detail: result.detail,
            status: result.status,
          };
        },
      ),
      timedCheck('brevo', 'Brevo / email', false, async () => {
        const key = process.env.BREVO_API_KEY;
        if (!key)
          return {
            ok: false,
            detail: 'Email transacional não configurado.',
            status: 'not_configured' as const,
          };
        return providerCheck('brevo', key);
      }),
    ]);

    const logsResult = await admin
      .from('platform_api_logs')
      .select(
        'id,request_id,route,method,status_code,duration_ms,level,error_code,environment,region,created_at',
      )
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(2000);
    const totalResult = await admin
      .from('platform_api_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', windowStart);
    const errorsResult = await admin
      .from('platform_api_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', windowStart)
      .gte('status_code', 500);
    const clientErrorsResult = await admin
      .from('platform_api_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', windowStart)
      .gte('status_code', 400)
      .lt('status_code', 500);
    const telemetryAvailable =
      !logsResult.error &&
      !totalResult.error &&
      !errorsResult.error &&
      !clientErrorsResult.error;
    const rows = telemetryAvailable
      ? ((logsResult.data ?? []) as ApiLogRow[])
      : [];
    const durations = rows
      .map((row) => row.duration_ms)
      .filter((value) => Number.isFinite(value) && value >= 0);
    const totalRequests = telemetryAvailable
      ? (totalResult.count ?? rows.length)
      : 0;
    const serverErrors = telemetryAvailable ? (errorsResult.count ?? 0) : 0;
    const clientErrors = telemetryAvailable
      ? (clientErrorsResult.count ?? 0)
      : 0;
    const routeMap = new Map<
      string,
      {
        requests: number;
        errors: number;
        durations: number[];
        lastSeenAt: string;
      }
    >();
    for (const row of rows) {
      const key = `${row.method} ${row.route}`;
      const current = routeMap.get(key) ?? {
        requests: 0,
        errors: 0,
        durations: [],
        lastSeenAt: row.created_at,
      };
      current.requests += 1;
      if (row.status_code >= 500) current.errors += 1;
      current.durations.push(row.duration_ms);
      if (row.created_at > current.lastSeenAt)
        current.lastSeenAt = row.created_at;
      routeMap.set(key, current);
    }
    const routes = [...routeMap.entries()]
      .map(([key, value]) => {
        const firstSpace = key.indexOf(' ');
        return {
          method: key.slice(0, firstSpace),
          route: key.slice(firstSpace + 1),
          requests: value.requests,
          errors: value.errors,
          errorRate: value.requests
            ? Math.round((value.errors / value.requests) * 1000) / 10
            : 0,
          p95LatencyMs: percentile(value.durations, 0.95),
          lastSeenAt: value.lastSeenAt,
        };
      })
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 50);
    const overall =
      databaseCheck.ok === false || shopsCheck.ok === false
        ? 'unhealthy'
        : [
              databaseCheck,
              telemetryCheck,
              shopsCheck,
              usersCheck,
              appointmentsCheck,
              subscriptionsCheck,
              auditCheck,
              stripeCheck,
              emailCheck,
            ].some((item) => !item.ok)
          ? 'degraded'
          : 'healthy';
    const logs = rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      route: row.route,
      method: row.method,
      statusCode: row.status_code,
      durationMs: row.duration_ms,
      level: row.level,
      errorCode: row.error_code,
      environment: row.environment,
      region: row.region,
      createdAt: row.created_at,
    }));
    return NextResponse.json(
      {
        ok: overall !== 'unhealthy',
        generatedAt: new Date().toISOString(),
        windowStart,
        overall,
        paymentMode,
        telemetryAvailable,
        metrics: {
          requests24h: totalRequests,
          errors5xx24h: serverErrors,
          clientErrors24h: clientErrors,
          errorRate: totalRequests
            ? Math.round((serverErrors / totalRequests) * 10000) / 100
            : 0,
          avgLatencyMs: durations.length
            ? Math.round(
                durations.reduce((sum, value) => sum + value, 0) /
                  durations.length,
              )
            : 0,
          p95LatencyMs: percentile(durations, 0.95),
          logSampleCount: rows.length,
        },
        checks: [
          databaseCheck,
          telemetryCheck,
          shopsCheck,
          usersCheck,
          appointmentsCheck,
          subscriptionsCheck,
          auditCheck,
          stripeCheck,
          emailCheck,
        ],
        routes,
        logs,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return NextResponse.json(
        { ok: false, error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    productionLogger.exception('silentra_admin.observability_failed', error, {
      route: '/api/silentra-admin/observability',
    });
    return NextResponse.json(
      { ok: false, error: 'Não foi possível recolher a telemetria da API.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export const GET = withApiObservability(
  '/api/silentra-admin/observability',
  GET_unobserved,
);
