import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LogLevel = 'info' | 'warn' | 'error';
type ApiLog = {
  id: number;
  occurred_at: string;
  request_id: string;
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
  level: LogLevel;
  error_code: string | null;
  message: string;
};

type Check = {
  id: string;
  label: string;
  state: 'ok' | 'warn' | 'error' | 'not_configured';
  durationMs: number | null;
  detail: string;
};

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function isMissingLogTable(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.code === '42P01' ||
      error.code === 'PGRST205' ||
      /platform_api_logs.*(not exist|schema cache)|relation .*platform_api_logs.*does not exist/i.test(
        error.message ?? '',
      )),
  );
}

export async function GET() {
  const generatedAt = new Date().toISOString();
  try {
    const { admin } = await requirePlatformAdmin();
    const checks: Check[] = [];

    const checkTable = async (
      id: string,
      label: string,
      table: string,
    ): Promise<void> => {
      const started = performance.now();
      try {
        const { error } = await admin
          .from(table)
          .select('*', { count: 'exact', head: true });
        const durationMs = Math.round(performance.now() - started);
        checks.push({
          id,
          label,
          state: error ? 'error' : 'ok',
          durationMs,
          detail: error
            ? 'A consulta à base de dados falhou.'
            : 'Ligação e consulta confirmadas.',
        });
      } catch {
        checks.push({
          id,
          label,
          state: 'error',
          durationMs: Math.round(performance.now() - started),
          detail: 'Não foi possível executar a verificação à base de dados.',
        });
      }
    };

    await Promise.all([
      checkTable('barbershops', 'Barbearias', 'barbershops'),
      checkTable('users', 'Utilizadores', 'users'),
      checkTable('appointments', 'Marcações', 'appointments'),
      checkTable('subscriptions', 'Subscrições', 'subscriptions'),
    ]);

    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const since5m = new Date(now - 5 * 60 * 1000).toISOString();

    const logsStarted = performance.now();
    const [historyResult, fourXXResult, fiveXXResult, requests5mResult] =
      await Promise.all([
        admin
          .from('platform_api_logs')
          .select(
            'id,occurred_at,request_id,method,route,status_code,duration_ms,level,error_code,message',
            { count: 'exact' },
          )
          .gte('occurred_at', since24h)
          .order('occurred_at', { ascending: false })
          .limit(2000),
        admin
          .from('platform_api_logs')
          .select('id', { count: 'exact', head: true })
          .gte('occurred_at', since24h)
          .gte('status_code', 400)
          .lt('status_code', 500),
        admin
          .from('platform_api_logs')
          .select('id', { count: 'exact', head: true })
          .gte('occurred_at', since24h)
          .gte('status_code', 500),
        admin
          .from('platform_api_logs')
          .select('id', { count: 'exact', head: true })
          .gte('occurred_at', since5m),
      ]);

    const logReadDuration = Math.round(performance.now() - logsStarted);
    const logsError = historyResult.error;
    const logsAvailable = !logsError;
    const migrationMissing = isMissingLogTable(logsError);

    checks.push({
      id: 'api_logs',
      label: 'Histórico de pedidos da API',
      state: logsAvailable
        ? 'ok'
        : migrationMissing
          ? 'not_configured'
          : 'error',
      durationMs: logReadDuration,
      detail: logsAvailable
        ? 'O histórico de pedidos está acessível.'
        : migrationMissing
          ? 'Falta aplicar a migração 20261010160000_platform_api_observability.sql.'
          : 'Não foi possível consultar o histórico de pedidos.',
    });

    const probeExternalService = async (options: {
      id: string;
      label: string;
      url: string;
      headers: Record<string, string>;
      configured: boolean;
    }) => {
      if (!options.configured) {
        checks.push({
          id: options.id,
          label: options.label,
          state: 'not_configured',
          durationMs: null,
          detail: 'As credenciais necessárias não estão configuradas.',
        });
        return;
      }

      const started = performance.now();
      try {
        const response = await fetch(options.url, {
          method: 'GET',
          headers: options.headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(4500),
        });
        checks.push({
          id: options.id,
          label: options.label,
          state: response.ok ? 'ok' : response.status >= 500 ? 'warn' : 'error',
          durationMs: Math.round(performance.now() - started),
          detail: response.ok
            ? 'O fornecedor respondeu ao pedido de verificação.'
            : response.status === 401 || response.status === 403
              ? 'O fornecedor recusou a autenticação.'
              : `O fornecedor respondeu com HTTP ${response.status}.`,
        });
      } catch {
        checks.push({
          id: options.id,
          label: options.label,
          state: 'warn',
          durationMs: Math.round(performance.now() - started),
          detail: 'O serviço externo não respondeu dentro do limite de tempo.',
        });
      }
    };

    const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim() || '';
    const brevoApiKey = process.env.BREVO_API_KEY?.trim() || '';
    await Promise.all([
      probeExternalService({
        id: 'stripe_api',
        label: 'API Stripe',
        url: 'https://api.stripe.com/v1/balance',
        headers: { Authorization: `Bearer ${stripeSecret}` },
        configured: Boolean(stripeSecret),
      }),
      probeExternalService({
        id: 'brevo_api',
        label: 'API Brevo / Email',
        url: 'https://api.brevo.com/v3/account',
        headers: { 'api-key': brevoApiKey, accept: 'application/json' },
        configured: Boolean(brevoApiKey),
      }),
    ]);

    const history = (historyResult.data ?? []) as ApiLog[];
    const totalRequests24h = historyResult.count ?? history.length;
    const errors24h =
      (fourXXResult.count ??
        history.filter((row) => row.status_code >= 400 && row.status_code < 500)
          .length) +
      (fiveXXResult.count ??
        history.filter((row) => row.status_code >= 500).length);
    const requests5m = requests5mResult.error
      ? history.filter(
          (row) => Date.parse(row.occurred_at) >= now - 5 * 60 * 1000,
        ).length
      : (requests5mResult.count ?? 0);
    const latencyValues = history.map((row) => Number(row.duration_ms) || 0);
    const averageLatencyMs = latencyValues.length
      ? Math.round(
          latencyValues.reduce((sum, value) => sum + value, 0) /
            latencyValues.length,
        )
      : 0;
    const p95LatencyMs = percentile(latencyValues, 95);
    const fiveXX24h =
      fiveXXResult.count ??
      history.filter((row) => row.status_code >= 500).length;
    const fourXX24h =
      fourXXResult.count ??
      history.filter((row) => row.status_code >= 400 && row.status_code < 500)
        .length;

    const byRoute = new Map<string, ApiLog[]>();
    for (const item of history) {
      const items = byRoute.get(item.route) ?? [];
      items.push(item);
      byRoute.set(item.route, items);
    }
    const endpoints = [...byRoute.entries()]
      .map(([route, items]) => {
        const durations = items.map((item) => item.duration_ms);
        const failed = items.filter((item) => item.status_code >= 400).length;
        return {
          route,
          requests: items.length,
          errors: failed,
          errorRate: Math.round((failed / items.length) * 1000) / 10,
          averageLatencyMs: Math.round(
            durations.reduce((sum, value) => sum + value, 0) /
              Math.max(items.length, 1),
          ),
          p95LatencyMs: percentile(durations, 95),
          lastStatusCode: items[0]?.status_code ?? 0,
          lastSeenAt: items[0]?.occurred_at ?? null,
        };
      })
      .sort((a, b) => b.errors - a.errors || b.requests - a.requests)
      .slice(0, 60);

    return NextResponse.json(
      {
        ok: checks.every((check) => check.state === 'ok'),
        generatedAt,
        logsAvailable,
        migrationMissing,
        summary: {
          requests5m,
          requests24h: totalRequests24h,
          errors24h,
          fiveXX24h,
          fourXX24h,
          errorRate24h: totalRequests24h
            ? Math.round((errors24h / totalRequests24h) * 1000) / 10
            : 0,
          averageLatencyMs,
          p95LatencyMs,
          sampledRequests: history.length,
          retainedWindowHours: 24,
        },
        endpoints,
        logs: history.slice(0, 300),
        checks,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    console.error('[SILENTRA_ADMIN_OBSERVABILITY]', {
      error_code:
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Não foi possível carregar a saúde operacional.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
