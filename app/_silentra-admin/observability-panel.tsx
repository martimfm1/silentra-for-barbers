'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Clock3,
  Database,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

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
type EndpointMetric = {
  route: string;
  requests: number;
  errors: number;
  errorRate: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  lastStatusCode: number;
  lastSeenAt: string | null;
};
type ObservabilityData = {
  generatedAt: string;
  logsAvailable: boolean;
  migrationMissing: boolean;
  summary: {
    requests5m: number;
    requests24h: number;
    errors24h: number;
    fiveXX24h: number;
    fourXX24h: number;
    errorRate24h: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    sampledRequests: number;
    retainedWindowHours: number;
  };
  endpoints: EndpointMetric[];
  logs: ApiLog[];
  checks: Check[];
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(parsed);
}

function statusTone(state: Check['state']) {
  if (state === 'ok') return 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200';
  if (state === 'error') return 'border-red-400/20 bg-red-400/[0.06] text-red-200';
  return 'border-amber-400/20 bg-amber-400/[0.05] text-amber-200';
}

function levelTone(level: LogLevel) {
  return level === 'error'
    ? 'bg-red-400/10 text-red-200'
    : level === 'warn'
      ? 'bg-amber-400/10 text-amber-200'
      : 'bg-emerald-400/10 text-emerald-200';
}

function httpTone(status: number) {
  return status >= 500
    ? 'text-red-300'
    : status >= 400
      ? 'text-amber-200'
      : 'text-emerald-300';
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : tone === 'bad' ? XCircle : Activity;
  const iconTone = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-red-300' : 'text-zinc-500';
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">{hint}</p>
        </div>
        <Icon className={`size-4 ${iconTone}`} />
      </div>
    </div>
  );
}

export default function ObservabilityPanel() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<'all' | LogLevel>('all');
  const [query, setQuery] = useState('');
  const [apiPing, setApiPing] = useState<{ ok: boolean; status: number; durationMs: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const apiStarted = performance.now();
    const apiPromise = fetch('/api/health', { cache: 'no-store' })
      .then((response) => {
        setApiPing({
          ok: response.ok,
          status: response.status,
          durationMs: Math.round(performance.now() - apiStarted),
        });
      })
      .catch(() => {
        setApiPing({
          ok: false,
          status: 0,
          durationMs: Math.round(performance.now() - apiStarted),
        });
      });

    try {
      const response = await fetch('/api/silentra-admin/observability', { cache: 'no-store' });
      const payload = (await response.json()) as ObservabilityData;
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os dados operacionais.');
      setData(payload);
      await apiPromise;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao consultar a saúde da API.');
      await apiPromise;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.logs ?? []).filter((log) => {
      if (level !== 'all' && log.level !== level) return false;
      if (!normalized) return true;
      return [log.route, log.method, log.message, log.error_code ?? '', log.request_id, String(log.status_code)]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [data, level, query]);

  const copyRequestId = async (requestId: string) => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopiedId(requestId);
    } catch {
      setError('Não foi possível copiar o identificador do pedido.');
    }
  };

  const requestSummary = data?.summary;
  const serviceChecks = data?.checks ?? [];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-emerald-300" />
            <h2 className="text-lg font-semibold">Saúde da API e observabilidade</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Tráfego, latência, erros HTTP, dependências e histórico técnico. Os dados históricos começam quando a instrumentação está ativa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm hover:bg-white/[0.08] disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar dados
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">{error}</div> : null}

      {data?.migrationMissing ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm text-amber-100">
          <p className="font-semibold">O histórico de pedidos ainda não está ativado.</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/70">
            Aplica a migração <code>20261010160000_platform_api_observability.sql</code> no Supabase. A plataforma continua operacional, mas não é possível guardar o histórico até essa tabela existir.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pedidos · últimos 5 min" value={requestSummary?.requests5m ?? '—'} hint="Volume recente registado" tone="neutral" />
        <MetricCard label="Pedidos · 24 horas" value={requestSummary?.requests24h ?? '—'} hint={`${requestSummary?.sampledRequests ?? 0} registos recentes carregados para análise`} />
        <MetricCard label="Respostas com erro" value={requestSummary?.errors24h ?? '—'} hint={`${requestSummary?.fiveXX24h ?? 0} erros de servidor (5xx) · ${requestSummary?.fourXX24h ?? 0} erros de cliente (4xx)`} tone={(requestSummary?.fiveXX24h ?? 0) > 0 ? 'bad' : (requestSummary?.errors24h ?? 0) > 0 ? 'warn' : 'good'} />
        <MetricCard label="Taxa de erro" value={requestSummary ? `${requestSummary.errorRate24h}%` : '—'} hint={`Latência média ${requestSummary?.averageLatencyMs ?? 0} ms · P95 ${requestSummary?.p95LatencyMs ?? 0} ms`} tone={(requestSummary?.errorRate24h ?? 0) >= 5 ? 'bad' : (requestSummary?.errorRate24h ?? 0) > 0 ? 'warn' : 'good'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-emerald-300" />
            <h3 className="font-semibold">Estado dos serviços</h3>
          </div>
          <div className="mt-4 space-y-2">
            {apiPing ? (
              <div className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${apiPing.ok ? 'border-emerald-400/15 bg-emerald-400/[0.035]' : 'border-red-400/20 bg-red-400/[0.04]'}`}>
                <div>
                  <p className="text-sm font-medium">Endpoint de saúde da aplicação</p>
                  <p className="mt-1 text-xs text-zinc-500">GET /api/health · resposta real desta instância</p>
                </div>
                <span className={`shrink-0 font-mono text-xs ${httpTone(apiPing.status)}`}>{apiPing.status || 'OFF'} · {apiPing.durationMs} ms</span>
              </div>
            ) : null}
            {serviceChecks.map((check) => {
              const Icon = check.state === 'ok' ? CheckCircle2 : check.state === 'error' ? XCircle : AlertTriangle;
              return (
                <div key={check.id} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${statusTone(check.state)}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="mt-1 text-xs leading-5 opacity-70">{check.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {check.durationMs !== null ? <span className="font-mono text-[10px] opacity-60">{check.durationMs} ms</span> : null}
                    <Icon className="size-4" />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-zinc-600">
            Uma credencial marcada como configurada não confirma, por si só, a disponibilidade externa do respetivo fornecedor.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-emerald-300" />
            <h3 className="font-semibold">Endpoints com mais erros</h3>
          </div>
          <p className="mt-1 text-xs text-zinc-600">Agrupado pelas rotas que geraram pedidos registados nas últimas 24 horas.</p>
          <div className="mt-4 space-y-2">
            {(data?.endpoints ?? []).filter((endpoint) => endpoint.errors > 0).slice(0, 8).map((endpoint) => (
              <div key={endpoint.route} className="rounded-xl border border-white/8 bg-black/15 p-3">
                <div className="flex items-start justify-between gap-3">
                  <code className="min-w-0 break-all text-[11px] text-zinc-300">{endpoint.route}</code>
                  <span className="shrink-0 text-xs font-semibold text-red-200">{endpoint.errors} erros</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-600">
                  <span>{endpoint.requests} pedidos</span><span>{endpoint.errorRate}% de erro</span><span>média {endpoint.averageLatencyMs} ms</span><span>P95 {endpoint.p95LatencyMs} ms</span>
                </div>
              </div>
            ))}
            {(data?.endpoints ?? []).every((endpoint) => endpoint.errors === 0) ? (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-zinc-500">
                {data?.logsAvailable ? 'Não foram registados erros nas rotas instrumentadas neste período.' : 'Os erros por endpoint ficam disponíveis depois de ativar o histórico da API.'}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-300" />
              <h3 className="font-semibold">Logs da API</h3>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Cada linha identifica o que aconteceu, em que endpoint, com que resposta e quanto tempo demorou. Não são guardados corpos nem credenciais.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar endpoint, erro ou request ID" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-xs outline-none focus:border-emerald-400/30" />
            </div>
            <select value={level} onChange={(event) => setLevel(event.target.value as 'all' | LogLevel)} className="h-10 rounded-xl border border-white/10 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none">
              <option value="all">Todos os níveis</option>
              <option value="error">Erro</option>
              <option value="warn">Aviso</option>
              <option value="info">Informação</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.13em] text-zinc-600">
                <th className="px-3 py-3 font-medium">Quando / nível</th>
                <th className="px-3 py-3 font-medium">Pedido e endpoint</th>
                <th className="px-3 py-3 font-medium">Resultado</th>
                <th className="px-3 py-3 font-medium">Tempo</th>
                <th className="px-3 py-3 font-medium">Identificador</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-white/[0.05] align-top hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-3 py-3">
                    <p className="text-xs text-zinc-300">{formatDate(log.occurred_at)}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${levelTone(log.level)}`}>{log.level === 'error' ? 'Erro' : log.level === 'warn' ? 'Aviso' : 'Info'}</span>
                  </td>
                  <td className="max-w-[420px] px-3 py-3">
                    <p className="text-xs font-medium text-zinc-200">{log.message}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{log.method}</span>
                      <code className="break-all text-[11px] text-zinc-400">{log.route}</code>
                    </p>
                    {log.error_code ? <p className="mt-1 font-mono text-[10px] text-red-300">Código: {log.error_code}</p> : null}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-3 font-mono text-xs ${httpTone(log.status_code)}`}>{log.status_code}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-zinc-400">{log.duration_ms} ms</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => void copyRequestId(log.request_id)} title="Copiar request ID" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 font-mono text-[10px] text-zinc-500 hover:text-zinc-200">
                      <Clipboard className="size-3" />{copiedId === log.request_id ? 'Copiado' : log.request_id.slice(0, 8)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Clock3 className="size-5 text-zinc-600" />
              <p className="text-sm text-zinc-400">{data?.logsAvailable ? 'Não há logs que correspondam aos filtros.' : 'Ainda não existem logs disponíveis.'}</p>
              <p className="max-w-lg text-xs leading-5 text-zinc-600">Só são visíveis pedidos capturados após a implementação e a ativação da migração de observabilidade.</p>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-col gap-1 text-[10px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>{filteredLogs.length} de {(data?.logs ?? []).length} registos carregados</span>
          <span>Última leitura: {formatDate(data?.generatedAt ?? null)}</span>
        </div>
      </section>

      <section className="rounded-xl border border-white/8 bg-black/15 p-4 text-xs leading-5 text-zinc-500">
        <p className="font-medium text-zinc-300">Como interpretar os dados</p>
        <p className="mt-1">4xx normalmente indica pedidos inválidos, sessões expiradas ou permissões recusadas. 5xx indica uma falha na aplicação ou numa dependência. A latência P95 representa o tempo dentro do qual terminou 95% da amostra recente.</p>
        <p className="mt-1">A tabela mostra até 300 linhas recentes e os indicadores por endpoint usam até 2.000 pedidos registados no intervalo. Pedidos e erros totais são contagens da base de dados quando a tabela está disponível.</p>
      </section>
    </section>
  );
}
