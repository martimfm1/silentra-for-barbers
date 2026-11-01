'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  Gift,
  Loader2,
  Mail,
  RotateCcw,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  reward_type: string;
  reward_value: number | null;
};
type Member = { email: string; name: string | null; points_balance: number };
type Redemption = {
  id: string;
  reward_id: string;
  points_spent: number;
  status: string;
  expires_at: string;
  created_at: string;
  validated_at: string | null;
};
type Props = { slug: string; shopName: string };
type ActiveRedemption = {
  id: string;
  code: string;
  token: string;
  qrPayload: string;
  pointsCost: number;
  pointsBalance: number;
  expiresAt: string;
  qrDataUrl: string;
};

function formatRemaining(expiresAt: string): string {
  const seconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function LoyaltyStore({ slug, shopName }: Props) {
  const [authenticated, setAuthenticated] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [activeRedemption, setActiveRedemption] =
    useState<ActiveRedemption | null>(null);
  const [countdown, setCountdown] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/loyalty/me?slug=${encodeURIComponent(slug)}`,
        { cache: 'no-store' },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error || 'Não foi possível carregar a fidelização.',
        );
      setAuthenticated(Boolean(data.authenticated));
      setMember(data.member ?? null);
      setRewards(Array.isArray(data.rewards) ? data.rewards : []);
      setRedemptions(Array.isArray(data.redemptions) ? data.redemptions : []);
      if (data.email) setEmail(data.email);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar a fidelização.',
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeRedemption) return;
    const update = () => {
      const remaining = Math.max(
        0,
        new Date(activeRedemption.expiresAt).getTime() - Date.now(),
      );
      if (remaining <= 0) {
        setActiveRedemption(null);
        setCountdown('');
        void load();
        return;
      }
      setCountdown(formatRemaining(activeRedemption.expiresAt));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [activeRedemption, load]);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Introduz um email válido.');
      return;
    }

    setBusy(true);
    setError(null);
    console.info('[LOYALTY_UI] request-code:start', {
      slug,
      emailLength: normalizedEmail.length,
    });

    try {
      const response = await fetch('/api/loyalty/request-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ slug, email: normalizedEmail }),
        credentials: 'same-origin',
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));
      console.info('[LOYALTY_UI] request-code:response', {
        status: response.status,
        success: Boolean(data?.success),
      });
      if (!response.ok)
        throw new Error(
          data?.error ||
            `Não foi possível enviar o código (${response.status}).`,
        );

      setEmail(normalizedEmail);
      setStep('code');
      toast.success('Código enviado. Verifica o teu email.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar o código.';
      console.error('[LOYALTY_UI] request-code:error', message);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/loyalty/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Código inválido.');
      setCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setBusy(false);
    }
  }

  const points = member?.points_balance ?? 0;
  const activePending = useMemo(
    () =>
      redemptions.find(
        (item) =>
          item.status === 'pending' &&
          new Date(item.expires_at).getTime() > Date.now(),
      ),
    [redemptions],
  );

  async function recoverRedemption(redemption: Redemption) {
    const remaining = new Date(redemption.expires_at).getTime() - Date.now();
    if (redemption.status !== 'pending' || remaining <= 0) {
      toast.error('Este voucher já expirou ou foi utilizado.');
      await load();
      return;
    }

    setRecoveringId(redemption.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/loyalty/redemption/recover?slug=${encodeURIComponent(slug)}&redemptionId=${encodeURIComponent(redemption.id)}`,
        { cache: 'no-store', credentials: 'same-origin' },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível recuperar o voucher.');
      const recovered = data.redemption;
      const qrDataUrl = await QRCode.toDataURL(recovered.qrPayload, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      setActiveRedemption({ ...recovered, qrDataUrl });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Não foi possível recuperar o voucher.';
      setError(message);
      toast.error(message);
    } finally {
      setRecoveringId(null);
    }
  }

  async function redeem() {
    if (!selectedReward || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, rewardId: selectedReward.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error || 'Não foi possível resgatar a recompensa.',
        );
      const redemption = data.redemption;
      const qrDataUrl = await QRCode.toDataURL(redemption.qrPayload, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      setActiveRedemption({ ...redemption, qrDataUrl });
      setSelectedReward(null);
      await load();
      if (data.emailSent)
        toast.success(
          'Resgate criado. Enviámos o QR e o código para o teu email.',
        );
      else
        toast.warning(
          'Resgate criado, mas não foi possível enviar o email. Usa o QR/código apresentado nesta página.',
        );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível resgatar a recompensa.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!activeRedemption) return;
    await navigator.clipboard.writeText(activeRedemption.code);
    toast.success('Código copiado.');
  }

  if (loading)
    return (
      <div className="grid min-h-64 place-items-center rounded-3xl border border-white/10 bg-white/[0.025]">
        <Loader2 className="size-5 animate-spin text-emerald-300" />
      </div>
    );
  if (error && !member && authenticated)
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-5 text-sm text-red-200">
        {error}
      </div>
    );

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl sm:p-8">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
          <Star className="size-5" />
        </div>
        {step === 'email' ? (
          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Entrar na fidelização</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Usa o email que costumas dar à {shopName}. Não precisas de
                password.
              </p>
            </div>
            <label className="block">
              <span className="sr-only">Email</span>
              <div className="flex items-center rounded-xl border border-white/10 bg-black/20 px-3">
                <Mail className="size-4 text-zinc-500" />
                <input
                  required
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@email.com"
                  className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            </label>
            {error ? (
              <p role="alert" className="text-xs text-red-300">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? 'A enviar…' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Confirma o teu email</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Enviámos um código de 6 dígitos para {email}.
              </p>
            </div>
            <input
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="000000"
              className="h-14 w-full rounded-xl border border-white/10 bg-black/20 text-center text-2xl tracking-[0.35em] text-white outline-none"
            />
            {error ? (
              <p role="alert" className="text-xs text-red-300">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? 'A confirmar…' : 'Entrar na fidelização'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="w-full text-xs text-zinc-500"
            >
              Usar outro email
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/[0.10] to-white/[0.02] p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          {shopName}
        </p>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">Saldo atual</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-white">
              {points}{' '}
              <span className="text-base font-medium text-emerald-300">
                pontos
              </span>
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">
            <Sparkles className="size-3.5 text-emerald-300" /> Programa ativo
          </div>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}
      {activePending && !activeRedemption ? (
        <section className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4 text-sm text-amber-100">
          Já tens uma recompensa reservada. Clica no resgate abaixo para voltar
          a ver o QR e o código enquanto continuam válidos.
        </section>
      ) : null}

      <section>
        <div className="mb-3">
          <h2 className="text-xl font-semibold">Recompensas</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Escolhe uma recompensa que consigas desbloquear agora.
          </p>
        </div>
        {rewards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
            Ainda não existem recompensas configuradas.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rewards.map((reward) => {
              const canRedeem =
                points >= reward.points_cost &&
                !activePending &&
                !activeRedemption;
              return (
                <article
                  key={reward.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                      <Gift className="size-5" />
                    </div>
                    <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {reward.points_cost} pts
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-white">
                    {reward.name}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    {reward.description || 'Recompensa de fidelização.'}
                  </p>
                  <button
                    aria-label={
                      canRedeem
                        ? 'Resgatar recompensa'
                        : 'Recompensa indisponível'
                    }
                    type="button"
                    disabled={!canRedeem}
                    onClick={() => setSelectedReward(reward)}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-600"
                  >
                    {points >= reward.points_cost
                      ? 'Resgatar recompensa'
                      : `Faltam ${reward.points_cost - points} pontos`}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {redemptions.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Os teus resgates</h2>
          <div className="space-y-2">
            {redemptions.map((item) => {
              const active =
                item.status === 'pending' &&
                new Date(item.expires_at).getTime() > Date.now();
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!active || recoveringId === item.id}
                  onClick={() => void recoverRedemption(item)}
                  aria-label={
                    active
                      ? 'Voltar a ver o QR e o código desta recompensa'
                      : 'Resgate já utilizado ou expirado'
                  }
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.04] disabled:cursor-default disabled:opacity-70"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {rewards.find((reward) => reward.id === item.reward_id)
                        ?.name ?? 'Recompensa'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.points_spent} pontos ·{' '}
                      {item.status === 'fulfilled'
                        ? 'Utilizada'
                        : item.status === 'pending'
                          ? `Por utilizar · ${formatRemaining(item.expires_at)}`
                          : 'Expirada'}
                    </p>
                    {active ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                        <RotateCcw className="size-3.5" /> Clique para voltar a
                        ver o voucher
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-600">
                    {recoveringId === item.id
                      ? 'A carregar…'
                      : new Date(item.created_at).toLocaleDateString('pt-PT')}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeRedemption ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto flex min-h-full w-full max-w-md items-center justify-center py-4">
            <div className="w-full rounded-3xl border border-emerald-400/20 bg-zinc-950 p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    Voucher ativo
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    Apresenta isto na barbearia
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRedemption(null)}
                  className="flex size-10 items-center justify-center rounded-full bg-white/5 text-zinc-400"
                  aria-label="Fechar"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4 text-center">
                <p className="text-xs text-amber-200">Válido durante 1 hora</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                  {countdown}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Depois deste tempo o QR e o código deixam de funcionar.
                </p>
              </div>
              <div className="mt-5 flex justify-center rounded-2xl bg-white p-4">
                <Image
                  src={activeRedemption.qrDataUrl}
                  alt="QR Code do voucher"
                  width={280}
                  height={280}
                  unoptimized
                  className="h-auto w-full max-w-[280px]"
                />
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Código manual
                </p>
                <p className="mt-2 text-2xl font-black tracking-[0.25em] text-white">
                  {activeRedemption.code}
                </p>
                <button
                  type="button"
                  onClick={() => void copyCode()}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-zinc-300"
                >
                  <Copy className="size-3.5" />
                  Copiar código
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <Mail className="size-3.5 shrink-0" />
                Enviámos também o QR e o código para o teu email.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedReward ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Confirmar resgate
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {selectedReward.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReward(null)}
                className="flex size-10 items-center justify-center rounded-full bg-white/5 text-zinc-400"
                aria-label="Fechar"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Custo</span>
                <strong>{selectedReward.points_cost} pontos</strong>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-zinc-500">Saldo depois</span>
                <strong>{points - selectedReward.points_cost} pontos</strong>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Ao confirmar, os pontos são debitados imediatamente. O QR e o
              código são enviados para o teu email e ficam válidos durante{' '}
              <strong className="text-zinc-200">1 hora</strong>.
            </p>
            <button
              type="button"
              onClick={() => void redeem()}
              disabled={busy}
              className="mt-5 h-12 w-full rounded-xl bg-emerald-400 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {busy ? 'A criar recompensa…' : 'Confirmar resgate'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
