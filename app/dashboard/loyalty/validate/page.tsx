'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrowserQRCodeReader } from '@zxing/browser';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

export default function LoyaltyValidationPage() {
  const { t } = useLanguage();
  const [slug, setSlug] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    rewardName: string;
    pointsCost: number;
    memberEmail: string;
  } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    fetch('/api/barbershops/public-profile', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(t('loyaltyValidation.loadBarbershopError'));
        return response.json();
      })
      .then((data) => setSlug(data.data?.slug ?? null))
      .catch(() => {
        setStatus(t('loyaltyValidation.loadBarbershopError'));
        toast.error(t('loyaltyValidation.loadPageError'));
      });
    return () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [t]);

  async function validate(value = identifier) {
    const clean = value.trim();
    if (!clean || !slug || busy) return;
    setBusy(true);
    setStatus(t('loyaltyValidation.validateStatus'));
    try {
      const response = await fetch('/api/loyalty/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, identifier: clean }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || t('loyaltyValidation.validateError'));
      setResult(data.redemption);
      setIdentifier('');
      stopCamera();
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
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    if (busy || cameraOpen) return;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      const message = t('loyaltyValidation.secureCameraError');
      toast.error(message);
      setStatus(message);
      return;
    }

    try {
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
        (result) => {
          if (!result || busy) return;
          const value = result.getText().trim();
          if (!value) return;
          setIdentifier(value);
          void validate(value);
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

  function stopCamera() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setStatus((current) =>
      current === t('loyaltyValidation.cameraReady') ||
      current === t('loyaltyValidation.openingCamera')
        ? t('loyaltyValidation.cameraClosed')
        : current,
    );
  }

  const maskedEmail = result?.memberEmail
    ? result.memberEmail.replace(/^(.).+(@.+)$/, '$1•••$2')
    : '';

  return (
    <main
      id="main-content"
      className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12"
    >
      <a className="skip-link" href="#validation-content">
        {t('loyaltyValidation.skip')}
      </a>
      <div
        id="validation-content"
        className="mx-auto w-full max-w-xl"
        tabIndex={-1}
      >
        <Link
          href="/dashboard/loyalty"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-zinc-400 hover:text-white"
          aria-label={t('loyaltyValidation.backAria')}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />{' '}
          {t('loyaltyValidation.loyalty')}
        </Link>
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            {t('loyaltyValidation.operations')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {t('loyaltyValidation.title')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            {t('loyaltyValidation.description')}
          </p>
          <p className="sr-announcer" aria-live="polite" aria-atomic="true">
            {status}
          </p>
        </div>

        {result ? (
          <section
            aria-labelledby="validation-success"
            className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-6 shadow-2xl sm:p-8"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {t('loyaltyValidation.success')}
            </p>
            <h2 id="validation-success" className="mt-2 text-2xl font-semibold">
              {result.rewardName}
            </h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <dt className="text-xs text-zinc-500">
                  {t('loyaltyValidation.pointsUsed')}
                </dt>
                <dd className="mt-1 text-lg font-semibold">
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
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setStatus(t('loyaltyValidation.readyForNext'));
              }}
              className="mt-6 h-12 w-full rounded-xl bg-white text-sm font-semibold text-zinc-950 focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              {t('loyaltyValidation.validateAnother')}
            </button>
          </section>
        ) : (
          <section
            className="mt-8 space-y-4"
            aria-label={t('loyaltyValidation.methods')}
          >
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/10 text-emerald-200">
                  <ScanLine className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {t('loyaltyValidation.readQr')}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {t('loyaltyValidation.mobileRecommended')}
                  </p>
                </div>
              </div>
              {cameraOpen ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-400/20 bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    aria-label={t('loyaltyValidation.cameraPreview')}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="min-h-11 w-full border-t border-white/10 text-sm text-zinc-300"
                  >
                    {t('loyaltyValidation.closeCamera')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-zinc-950"
                >
                  <Camera className="size-4" aria-hidden="true" />{' '}
                  {t('loyaltyValidation.openCamera')}
                </button>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold">
                    {t('loyaltyValidation.enterCode')}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {t('loyaltyValidation.qrFallback')}
                  </p>
                </div>
              </div>
              <form
                className="mt-5 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void validate();
                }}
                aria-busy={busy}
              >
                <div className="min-w-0 flex-1">
                  <label htmlFor="loyalty-validation-code" className="sr-only">
                    {t('loyaltyValidation.rewardCode')}
                  </label>
                  <input
                    id="loyalty-validation-code"
                    autoComplete="off"
                    value={identifier}
                    onChange={(event) =>
                      setIdentifier(
                        event.target.value.toUpperCase().slice(0, 256),
                      )
                    }
                    placeholder={t('loyaltyValidation.codePlaceholder')}
                    aria-describedby="loyalty-validation-help"
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm tracking-[0.08em] outline-none focus:border-white/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !identifier.trim()}
                  aria-disabled={busy || !identifier.trim()}
                  className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : null}
                  {busy
                    ? t('loyaltyValidation.validating')
                    : t('loyaltyValidation.validate')}
                </button>
              </form>
              <p
                id="loyalty-validation-help"
                className="mt-2 text-xs text-zinc-600"
              >
                {t('loyaltyValidation.codeHelp')}
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
