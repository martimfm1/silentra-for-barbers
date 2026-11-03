'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrowserQRCodeReader } from '@zxing/browser';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Gift,
  Loader2,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type RedemptionResult = {
  rewardName: string;
  pointsCost: number;
  memberEmail: string;
};

function extractRedemptionToken(rawValue: string): string | null {
  const value = rawValue.trim();
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();

  try {
    const url = new URL(value);
    const token =
      url.searchParams.get('token') ??
      url.searchParams.get('qrPayload') ??
      url.searchParams.get('payload');
    if (token && /^[a-f0-9]{64}$/i.test(token.trim()))
      return token.trim().toLowerCase();
  } catch {
    // The QR's normal payload is the opaque token itself, not a URL.
  }

  return null;
}

function maskEmail(value: string): string {
  return value.replace(/^(.).+(@.+)$/, '$1•••$2');
}

export default function LoyaltyValidationPage() {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedemptionResult | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const validatingRef = useRef(false);
  const scanHandledRef = useRef(false);

  useEffect(
    () => () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  function stopCamera() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    scanHandledRef.current = false;
  }

  async function validate(value: string, source: 'manual' | 'qr' = 'manual') {
    const clean = value.trim();
    if (!clean || validatingRef.current) return;

    validatingRef.current = true;
    setBusy(true);
    setStatus(t('loyaltyValidation.validateStatus'));

    try {
      const response = await fetch('/api/loyalty/validate', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        // The validation API resolves the barbershop from the signed-in staff
        // session. Do not send the public-page slug as an unknown body field.
        body: JSON.stringify({ identifier: clean }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('loyaltyValidation.validateError'));

      setResult(data.redemption as RedemptionResult);
      setIdentifier('');
      if (source === 'qr') stopCamera();
      setStatus(
        t('loyaltyValidation.successStatus', {
          reward: data.redemption?.rewardName ?? '',
        }),
      );
      toast.success(t('loyaltyValidation.successToast'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('loyaltyValidation.validateGenericError');
      setStatus(message);
      toast.error(message);
      if (source === 'qr') stopCamera();
    } finally {
      validatingRef.current = false;
      setBusy(false);
    }
  }

  async function startCamera() {
    if (validatingRef.current || cameraOpen) return;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      const message = t('loyaltyValidation.secureCameraError');
      toast.error(message);
      setStatus(message);
      return;
    }

    try {
      scanHandledRef.current = false;
      setCameraOpen(true);
      setStatus(t('loyaltyValidation.openingCamera'));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );

      const video = videoRef.current;
      if (!video)
        throw new Error(t('loyaltyValidation.cameraPreviewUnavailable'));

      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        video,
        (decoded) => {
          if (!decoded || scanHandledRef.current || validatingRef.current)
            return;

          const token = extractRedemptionToken(decoded.getText());
          if (!token) {
            const message = t('loyaltyValidation.invalidQr');
            setStatus(message);
            return;
          }

          scanHandledRef.current = true;
          // A scanned QR contains a private voucher token. Keep it out of the
          // visible manual-code field, which is reserved for the 8-char code.
          stopCamera();
          void validate(token, 'qr');
        },
      );

      scannerControlsRef.current = controls;
      streamRef.current =
        video.srcObject instanceof MediaStream ? video.srcObject : null;
      setStatus(t('loyaltyValidation.cameraReady'));
    } catch (error) {
      stopCamera();
      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? t('loyaltyValidation.cameraBlocked')
          : error instanceof DOMException && error.name === 'NotFoundError'
            ? t('loyaltyValidation.noCamera')
            : t('loyaltyValidation.cameraAccessError');
      toast.error(message);
      setStatus(message);
    }
  }

  const maskedEmail = result?.memberEmail
    ? maskEmail(result.memberEmail)
    : '';

  return (
    <main
      id="main-content"
      className="min-h-screen bg-zinc-950 px-4 py-7 text-zinc-100 sm:px-6 sm:py-10"
    >
      <a className="skip-link" href="#validation-content">
        {t('loyaltyValidation.skip')}
      </a>
      <div id="validation-content" className="mx-auto w-full max-w-4xl" tabIndex={-1}>
        <Link
          href="/dashboard/loyalty"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white"
          aria-label={t('loyaltyValidation.backAria')}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('loyaltyValidation.loyalty')}
        </Link>

        <header className="mt-7 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            {t('loyaltyValidation.operations')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('loyaltyValidation.title')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {t('loyaltyValidation.description')}
          </p>
          <p className="sr-announcer mt-2" aria-live="polite" aria-atomic="true">
            {status}
          </p>
        </header>

        {result ? (
          <Card className="mt-8 overflow-hidden border-emerald-400/20 bg-emerald-400/[0.06]">
            <CardContent className="p-6 sm:p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                {t('loyaltyValidation.success')}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {result.rewardName}
              </h2>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <dt className="text-xs text-zinc-500">
                    {t('loyaltyValidation.pointsUsed')}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">
                    {result.pointsCost}
                  </dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <dt className="text-xs text-zinc-500">
                    {t('loyaltyValidation.client')}
                  </dt>
                  <dd className="mt-1 truncate text-sm font-medium">
                    {maskedEmail}
                  </dd>
                </div>
              </dl>
              <Button
                type="button"
                onClick={() => {
                  setResult(null);
                  setStatus(t('loyaltyValidation.readyForNext'));
                }}
                className="mt-6 min-h-11 w-full bg-white font-semibold text-zinc-950 hover:bg-zinc-200"
              >
                {t('loyaltyValidation.validateAnother')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section className="mt-8 grid gap-4 lg:grid-cols-2" aria-label={t('loyaltyValidation.methods')}>
            <Card className="border-white/10 bg-white/[0.025]">
              <CardHeader>
                <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                  <ScanLine className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="pt-2">{t('loyaltyValidation.readQr')}</CardTitle>
                <CardDescription>
                  {t('loyaltyValidation.mobileRecommended')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cameraOpen ? (
                  <div className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      aria-label={t('loyaltyValidation.cameraPreview')}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={stopCamera}
                      className="min-h-11 w-full rounded-none border-t border-white/10 text-zinc-300"
                    >
                      {t('loyaltyValidation.closeCamera')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void startCamera()}
                    disabled={busy}
                    className="min-h-12 w-full bg-emerald-400 font-semibold text-zinc-950 hover:bg-emerald-300"
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    {t('loyaltyValidation.openCamera')}
                  </Button>
                )}
                <p className="mt-3 text-xs leading-5 text-zinc-500">
                  {t('loyaltyValidation.qrScanHint')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.025]">
              <CardHeader>
                <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300">
                  <Gift className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="pt-2">{t('loyaltyValidation.enterCode')}</CardTitle>
                <CardDescription>
                  {t('loyaltyValidation.codeHelp')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void validate(identifier, 'manual');
                  }}
                  aria-busy={busy}
                >
                  <label htmlFor="loyalty-validation-code" className="text-sm font-medium">
                    {t('loyaltyValidation.rewardCode')}
                  </label>
                  <Input
                    id="loyalty-validation-code"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    inputMode="text"
                    maxLength={8}
                    value={identifier}
                    onChange={(event) =>
                      setIdentifier(
                        event.target.value
                          .replace(/[^a-hj-np-z2-9]/gi, '')
                          .toUpperCase()
                          .slice(0, 8),
                      )
                    }
                    placeholder={t('loyaltyValidation.codePlaceholder')}
                    className="h-12 border-white/10 bg-black/20 text-center font-mono text-lg tracking-[0.24em]"
                    aria-describedby="loyalty-validation-help"
                  />
                  <p id="loyalty-validation-help" className="text-xs text-zinc-500">
                    {t('loyaltyValidation.manualCodeHint')}
                  </p>
                  <Button
                    type="submit"
                    disabled={busy || identifier.length !== 8}
                    className="min-h-12 w-full"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="size-4" aria-hidden="true" />
                    )}
                    {busy
                      ? t('loyaltyValidation.validating')
                      : t('loyaltyValidation.validate')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
