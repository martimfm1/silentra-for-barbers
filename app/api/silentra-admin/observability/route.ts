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
      const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
      const durationMs = Math.round(performance.now() - started);
      checks.push({
        id,
        label,
        state: error ? 'error' : 'ok',
        durationMs,
        detail: error ? 'A consulta à base de dados falhou.' : 'Ligação e consulta confirmadas.',
      });
    };

    const [barbershopsCheck, usersCheck, appointmentsCheck, subscriptionsCheck] =
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
    const [
      historyResult,
      errorsResult,
      requests5mResult,
    ] = await Promise.all([
      admin
        .from('platform_api_logs')
        .select('id,occurred_at,request_id,method,route,status_code,duration_ms,level,error_code,message', { count: 'exact' })
        .gte('occurred_at', since24h)
        .order('occurred_at', { ascending: false })
        .limit(2000),
      admin
        .from('platform_api_logs')
        .select('id', { count: 'exact', head: true })
        .gte('occurred_at', since24h)
        .gte('status_code', 400),
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
      state: logsAvailable ? 'ok' : migrationMissing ? 'not_configured' : 'error',
      durationMs: logReadDuration,
      detail: logsAvailable
        ? 'O histórico de pedidos está acessível.'
        : migrationMissing
          ? 'Falta aplicar a migração 20261010160000_platform_api_observability.sql.'
          : 'Não foi possível consultar o histórico de pedidos.',
    });

    const envChecks: Array<{ id: string; label: string; ok: boolean; detail: string }> = [
      {
        id: 'supabase_config',
        label: 'Configuração Supabase',
        ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
        detail: 'Verifica apenas a presença das variáveis necessárias.',
      },
      {
        id: 'stripe_config',
        label: 'Configuração Stripe',
        ok: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
        detail: 'Credencial configurada; esta verificação não executa pagamentos.',
      },
      {
        id: 'email_config',
        label: 'Configuração de email',
        ok: Boolean(process.env.BREVO_API_KEY?.trim() && (process.env.BREVO_FROM_EMAIL?.trim() || process.env.SENDER_EMAIL?.trim())),
        detail: 'Credenciais configuradas; não envia email de teste.',
      },
    ];
    for (const check of envChecks) {
      checks.push({
        id: check.id,
        label: check.label,
        state: check.ok ? 'ok' : 'warn',
        durationMs: null,
        detail: check.detail,
      });
    }

    const history = (historyResult.data ?? []) as ApiLog[];
    const totalRequests24h = historyResult.count ?? history.length;
    const errors24h = errorsResult.error ? history.filter((row) => row.status_code >= 400).length : (errorsResult.count ?? 0);
    const requests5m = requests5mResult.error ? history.filter((row) => Date.parse(row.occurred_at) >= now - 5 * 60 * 1000).length : (requests5mResult.count ?? 0);
    const latencyValues = history.map((row) => Number(row.duration_ms) || 0);
    const averageLatencyMs = latencyValues.length
      ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
      : 0;
    const p95LatencyMs = percentile(latencyValues, 95);
    const fiveXX24h = history.filter((row) => row.status_code >= 500).length;
    const fourXX24h = history.filter((row) => row.status_code >= 400 && row.status_code < 500).length;

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
          averageLatencyMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / Math.max(items.length, 1)),
          p95LatencyMs: percentile(durations, 95),
          lastStatusCode: items[0]?.status_code ?? 0,
          lastSeenAt: items[0]?.occurred_at ?? null,
        };
      })
      .sort((a, b) => b.errors - a.errors || b.requests - a.requests)
      .slice(0, 60);

    return NextResponse.json(
      {
        ok: checks.every((check) => check.state === 'ok' || check.state === 'not_configured'),
        generatedAt,
        logsAvailable,
        migrationMissing,
        summary: {
          requests5m,
          requests24h: totalRequests24h,
          errors24h,
          fiveXX24h,
          fourXX24h,
          errorRate24h: totalRequests24h ? Math.round((errors24h / totalRequests24h) * 1000) / 10 : 0,
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
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('[SILENTRA_ADMIN_OBSERVABILITY]', {
      error_code:
        error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
          ? error.code
          : 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Não foi possível carregar a saúde operacional.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
