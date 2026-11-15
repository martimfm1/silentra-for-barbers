'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  CheckCircle2,
  Copy,
  Link2,
  RefreshCw,
  Unplug,
  WalletCards,
} from 'lucide-react';

type ConnectionState = {
  connected: boolean;
  accountName: string | null;
  currencyCode: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  pendingEvents: number;
  failedEvents: number;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
  connected?: boolean;
  accountName?: string | null;
  currencyCode?: string | null;
  connectedAt?: string | null;
  lastSyncedAt?: string | null;
  pendingEvents?: number;
  failedEvents?: number;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function MoneyFlowIntegrationPanel() {
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [pairingToken, setPairingToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/silentra-admin/moneyflow/connect', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as ApiResult;
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error || 'Não foi possível carregar o MoneyFlow.');
      }
      setConnection({
        connected: payload.connected === true,
        accountName: payload.accountName ?? null,
        currencyCode: payload.currencyCode ?? null,
        connectedAt: payload.connectedAt ?? null,
        lastSyncedAt: payload.lastSyncedAt ?? null,
        pendingEvents: payload.pendingEvents ?? 0,
        failedEvents: payload.failedEvents ?? 0,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function connect() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/silentra-admin/moneyflow/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairingToken: pairingToken.trim() }),
          cache: 'no-store',
        });
        const payload = (await response.json()) as ApiResult;
        if (!response.ok || payload.ok !== true) {
          throw new Error(payload.error || 'Não foi possível ligar ao MoneyFlow.');
        }
        setPairingToken('');
        setMessage('MoneyFlow ligado. Os novos pagamentos confirmados serão sincronizados.');
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Erro inesperado.');
      }
    });
  }

  function disconnect() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/silentra-admin/moneyflow/connect', {
          method: 'DELETE',
          cache: 'no-store',
        });
        const payload = (await response.json()) as ApiResult;
        if (!response.ok || payload.ok !== true) {
          throw new Error(payload.error || 'Não foi possível desligar o MoneyFlow.');
        }
        setMessage('Ligação ao MoneyFlow desligada.');
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Erro inesperado.');
      }
    });
  }

  async function copyIntegrationInfo() {
    if (!connection?.connected) return;
    const details = [
      'MoneyFlow: ligado',
      `Conta: ${connection.accountName ?? '—'}`,
      `Moeda: ${connection.currencyCode ?? '—'}`,
      `Ligado em: ${formatDate(connection.connectedAt)}`,
      `Última sincronização: ${formatDate(connection.lastSyncedAt)}`,
      `Eventos pendentes: ${connection.pendingEvents}`,
      `Eventos com erro: ${connection.failedEvents}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
    } catch {
      setError('Não foi possível copiar o estado da ligação.');
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-200">
              <WalletCards className="size-4" />
            </span>
            <div>
              <h2 className="font-semibold">Ligação ao MoneyFlow</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                Sincroniza apenas pagamentos de subscrições da plataforma que já
                estejam confirmados. As receitas de marcações e vendas das
                barbearias nunca entram na conta financeira da Silentra.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || isPending}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-semibold text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-zinc-500">A carregar estado da ligação…</p>
        ) : connection?.connected ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-emerald-100">MoneyFlow ligado</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Conta: {connection.accountName} · {connection.currencyCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyIntegrationInfo()}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/[0.05]"
              >
                <Copy className="size-3.5" />
                {copied ? 'Copiado' : 'Copiar estado'}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={disconnect}
                disabled={isPending}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-400/15 px-3 text-xs font-medium text-red-200 transition hover:bg-red-400/[0.05] disabled:opacity-50"
              >
                <Unplug className="size-3.5" />
                {isPending ? 'A desligar…' : 'Desligar integração'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/8 bg-black/15 p-4">
                <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-600">Ligação criada</p>
                <p className="mt-2 text-sm font-semibold text-zinc-200">{formatDate(connection.connectedAt)}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/15 p-4">
                <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-600">Último envio</p>
                <p className="mt-2 text-sm font-semibold text-zinc-200">{formatDate(connection.lastSyncedAt)}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/15 p-4">
                <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-600">Na fila</p>
                <p className="mt-2 text-sm font-semibold text-zinc-200">{connection.pendingEvents}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/15 p-4">
                <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-600">Com erro</p>
                <p className="mt-2 text-sm font-semibold text-zinc-200">{connection.failedEvents}</p>
              </div>
            </div>
            <p className="text-xs leading-5 text-zinc-600">
              O token de sincronização é guardado apenas no servidor e nunca é
              devolvido ao painel ou exposto ao browser.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-black/10 p-4">
            <p className="text-sm font-semibold">Ainda não está ligado</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
              No MoneyFlow, abre Definições → Integrações → Silentra for Barbers,
              escolhe a conta em EUR e gera um código de utilização única. Cola-o
              aqui para concluir o emparelhamento.
            </p>
            <label className="mt-4 grid gap-2 text-xs font-medium text-zinc-400">
              Código de ligação (válido durante 15 minutos)
              <input
                value={pairingToken}
                onChange={(event) => setPairingToken(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Cola aqui o código de ligação"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
              />
            </label>
            <button
              type="button"
              onClick={connect}
              disabled={isPending || !/^[a-f0-9]{64}$/i.test(pairingToken.trim())}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-bold text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Link2 className="size-3.5" />
              )}
              Ligar MoneyFlow
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex items-start gap-3">
          <Unplug className="mt-0.5 size-4 shrink-0 text-zinc-500" />
          <div>
            <p className="text-xs font-semibold text-zinc-300">O que é sincronizado</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Pagamentos Stripe de faturas de subscrição em EUR e pagamentos
              manuais quando o comprovativo de pagamento é criado após confirmação.
              Eventos repetidos não criam movimentos duplicados.
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <p role="status" className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-3 text-xs text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-xs text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
