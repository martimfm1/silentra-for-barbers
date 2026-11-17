'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

type InviteMethod = 'code' | 'link' | 'qr';

type ActiveInvite = {
  id: string;
  role: string;
  invite_method: InviteMethod;
  expires_at: string;
  created_at: string;
};

type GeneratedInvite = {
  id: string;
  value: string;
  method: InviteMethod;
  expiresAt: string;
};

type InviteCodeCardProps = {
  seats?: { used: number; limit: number; unlimited: boolean };
};

const INVITE_CODE_PATTERN =
  /^BARB-(?:[0-9A-HJ-NP-Z]{4}-){2}[0-9A-HJ-NP-Z]{4}$/;
const LINK_TOKEN_PATTERN = /^SIL-[0-9A-F]{32}$/;
const EXPIRY_OPTIONS = [
  { value: 24, labelKey: 'oneDay' },
  { value: 72, labelKey: 'threeDays' },
  { value: 168, labelKey: 'sevenDays' },
] as const;

export function InviteCodeCard({ seats }: InviteCodeCardProps) {
  const { t } = useLanguage();
  const [method, setMethod] = useState<InviteMethod>('link');
  const [expiresInHours, setExpiresInHours] = useState(168);
  const [invite, setInvite] = useState<GeneratedInvite | null>(null);
  const [activeInvites, setActiveInvites] = useState<ActiveInvite[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const inviteUrl = useMemo(() => {
    if (!invite || !origin) return null;
    const url = new URL('/onboarding', origin);
    url.searchParams.set('invite', invite.value);
    return url.toString();
  }, [invite, origin]);

  const teamFull = Boolean(
    seats && !seats.unlimited && seats.used >= seats.limit,
  );

  const loadInvites = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const response = await fetch('/api/team/invite', {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('inviteCode.loadError'));
      setActiveInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('inviteCode.loadError'),
      );
    } finally {
      setLoadingInvites(false);
    }
  }, [t]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  useEffect(() => {
    let cancelled = false;
    if (!inviteUrl || invite?.method !== 'qr') {
      setQrDataUrl(null);
      return;
    }

    void QRCode.toDataURL(inviteUrl, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#09090b', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          toast.error(t('inviteCode.qrError'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inviteUrl, invite?.method, t]);

  async function generate() {
    if (teamFull) return;
    setLoading(true);
    setCopied(false);
    setInvite(null);
    setQrDataUrl(null);

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, expiresInHours }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('inviteCode.generateError'));

      const value = String(data.inviteValue ?? '').toUpperCase();
      if (
        !INVITE_CODE_PATTERN.test(value) &&
        !LINK_TOKEN_PATTERN.test(value)
      ) {
        throw new Error(t('inviteCode.invalidFormat'));
      }

      setInvite({
        id: String(data.inviteId),
        value,
        method,
        expiresAt: String(data.expiresAt),
      });
      await loadInvites();
      toast.success(t('inviteCode.created'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('inviteCode.generateError'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyValue(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
    } catch {
      toast.error(t('inviteCode.copyError'));
    }
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('inviteCode.shareTitle'),
          text: t('inviteCode.shareDescription'),
          url: inviteUrl,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyValue(inviteUrl, t('inviteCode.linkCopied'));
  }

  async function revokeInvite(inviteId: string) {
    setRevokingId(inviteId);
    try {
      const response = await fetch('/api/team/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('inviteCode.revokeError'));
      if (invite?.id === inviteId) setInvite(null);
      await loadInvites();
      toast.success(t('inviteCode.revoked'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('inviteCode.revokeError'),
      );
    } finally {
      setRevokingId(null);
    }
  }

  const formatExpiry = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  return (
    <Card className="glassmorphism rounded-3xl border-white/10 shadow-xl">
      <CardHeader className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold text-zinc-50">
              {t('inviteCode.title')}
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              {t('inviteCode.description')}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 p-5 sm:p-6">
        {teamFull && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-100">
            <p className="font-semibold">{t('inviteCode.limitReached')}</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/60">
              {t('inviteCode.noSeats')}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setMethod('code')}
            aria-pressed={method === 'code'}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left transition-colors ${
              method === 'code'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                : 'border-white/10 bg-white/[0.025] text-zinc-400 hover:bg-white/[0.05]'
            }`}
          >
            <KeyRound className="size-5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">{t('inviteCode.methodCode')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMethod('link')}
            aria-pressed={method === 'link'}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left transition-colors ${
              method === 'link'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                : 'border-white/10 bg-white/[0.025] text-zinc-400 hover:bg-white/[0.05]'
            }`}
          >
            <Link2 className="size-5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">{t('inviteCode.methodLink')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMethod('qr')}
            aria-pressed={method === 'qr'}
            className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 text-left transition-colors ${
              method === 'qr'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-white'
                : 'border-white/10 bg-white/[0.025] text-zinc-400 hover:bg-white/[0.05]'
            }`}
          >
            <QrCode className="size-5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium">{t('inviteCode.methodQr')}</span>
          </button>
        </div>

        <div className="grid gap-2 sm:max-w-xs">
          <label
            htmlFor="team-invite-expiry"
            className="text-xs font-medium text-zinc-400"
          >
            {t('inviteCode.validity')}
          </label>
          <select
            id="team-invite-expiry"
            value={expiresInHours}
            onChange={(event) => setExpiresInHours(Number(event.target.value))}
            className="min-h-11 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(`inviteCode.${option.labelKey}`)}
              </option>
            ))}
          </select>
        </div>

        <Button
          onClick={generate}
          disabled={loading || teamFull}
          aria-label={loading ? t('common.loading') : t('inviteCode.generate')}
          className="min-h-11 bg-emerald-600 text-white hover:bg-emerald-500 sm:w-fit"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" aria-hidden="true" />
              {t('inviteCode.generate')}
            </>
          )}
        </Button>

        {invite && (
          <div className="grid gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
              <ShieldCheck className="size-4" aria-hidden="true" />
              {t('inviteCode.created')}
            </div>

            {invite.method === 'code' && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  {t('inviteCode.code')}
                </p>
                <p className="mt-1 break-all font-mono text-lg font-bold tracking-[0.12em] text-white sm:text-xl">
                  {invite.value}
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    void copyValue(invite.value, t('inviteCode.copied'))
                  }
                  className="mt-3 min-h-10 border-white/10 bg-transparent text-white hover:bg-white/5"
                >
                  {copied ? (
                    <Check className="mr-2 size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {t('inviteCode.copyCode')}
                </Button>
              </div>
            )}

            {invite.method === 'link' && inviteUrl && (
              <div className="grid gap-3">
                <p className="text-xs leading-5 text-zinc-400">
                  {t('inviteCode.linkDescription')}
                </p>
                <p className="break-all rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-200">
                  {inviteUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void copyValue(inviteUrl, t('inviteCode.linkCopied'))
                    }
                    className="min-h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <Copy className="mr-2 size-4" aria-hidden="true" />
                    {t('inviteCode.copyLink')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void shareInvite()}
                    className="min-h-10 border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    <Link2 className="mr-2 size-4" aria-hidden="true" />
                    {t('inviteCode.share')}
                  </Button>
                </div>
              </div>
            )}

            {invite.method === 'qr' && inviteUrl && (
              <div className="grid justify-items-center gap-3 text-center">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt={t('inviteCode.qrAlt')}
                    width={224}
                    height={224}
                    unoptimized
                    className="rounded-xl bg-white p-2"
                  />
                ) : (
                  <div className="flex size-56 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                    <Loader2
                      className="size-6 animate-spin text-zinc-400"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <p className="max-w-md break-all text-xs text-zinc-400">
                  {inviteUrl}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    onClick={() =>
                      void copyValue(inviteUrl, t('inviteCode.linkCopied'))
                    }
                    className="min-h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <Copy className="mr-2 size-4" aria-hidden="true" />
                    {t('inviteCode.copyLink')}
                  </Button>
                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download="silentra-convite-equipa.png"
                      className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm text-white transition-colors hover:bg-white/5"
                    >
                      {t('inviteCode.downloadQr')}
                    </a>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => void shareInvite()}
                    className="min-h-10 border-white/10 bg-transparent text-white hover:bg-white/5"
                  >
                    <Link2 className="mr-2 size-4" aria-hidden="true" />
                    {t('inviteCode.share')}
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-zinc-500">
              {t('inviteCode.expires')} {formatExpiry(invite.expiresAt)}
            </p>
          </div>
        )}

        <div className="grid gap-3 border-t border-white/10 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {t('inviteCode.activeTitle')}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                {t('inviteCode.activeDescription')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadInvites()}
              disabled={loadingInvites}
              className="text-zinc-400 hover:text-white"
            >
              <RefreshCw
                className={`mr-2 size-3.5 ${loadingInvites ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {t('inviteCode.refresh')}
            </Button>
          </div>

          {loadingInvites ? (
            <div className="flex items-center gap-2 py-3 text-xs text-zinc-500">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('inviteCode.loading')}
            </div>
          ) : activeInvites.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-zinc-500">
              {t('inviteCode.empty')}
            </p>
          ) : (
            <div className="grid gap-2">
              {activeInvites.map((activeInvite) => (
                <div
                  key={activeInvite.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">
                      {t(
                        activeInvite.invite_method === 'qr'
                          ? 'inviteCode.methodQr'
                          : activeInvite.invite_method === 'link'
                            ? 'inviteCode.methodLink'
                            : 'inviteCode.methodCode',
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t('inviteCode.expires')} {formatExpiry(activeInvite.expires_at)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revokingId === activeInvite.id}
                    onClick={() => void revokeInvite(activeInvite.id)}
                    className="min-h-9 border-red-500/20 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    {revokingId === activeInvite.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 size-4" aria-hidden="true" />
                    )}
                    {t('inviteCode.revoke')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs leading-5 text-zinc-500">
          {t('inviteCode.singleUseSecurity')}
        </p>
      </CardContent>
    </Card>
  );
}
