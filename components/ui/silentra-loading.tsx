'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import LightTunnel from '@/components/ui/light-tunnel';
import { StrokeWordmark } from '@/components/ui/stroke-wordmark';

type SilentraLoadingProps = {
  variant?: 'fullscreen' | 'compact';
  message?: string;
};

function useLoadingAccent() {
  const [accent, setAccent] = useState('#34d399');

  useEffect(() => {
    const bodyStyles = getComputedStyle(document.body);
    const rootStyles = getComputedStyle(document.documentElement);
    const next =
      bodyStyles.getPropertyValue('--dashboard-accent').trim() ||
      rootStyles.getPropertyValue('--primary').trim();

    if (next) setAccent(next);
  }, []);

  return accent;
}

export function SilentraLoading({
  variant = 'fullscreen',
  message,
}: SilentraLoadingProps) {
  const { locale } = useLanguage();
  const accent = useLoadingAccent();
  const compact = variant === 'compact';
  const resolvedMessage =
    message ??
    (compact
      ? locale === 'en'
        ? 'Preparing your dashboard'
        : 'A preparar a tua dashboard'
      : locale === 'en'
        ? 'Preparing your experience'
        : 'A preparar a experiência');

  const tunnelStyle = {
    background:
      'radial-gradient(ellipse at center, color-mix(in srgb, ' +
      accent +
      ' 16%, transparent), transparent 60%), #08090b',
  };

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={resolvedMessage}
        className="relative isolate flex h-[112px] w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#08090b] text-center"
      >
        <LightTunnel
          className="absolute inset-0"
          style={tunnelStyle}
          cableColor={accent}
          pulseColor={accent}
          tunnelColor={accent}
          speed={0.11}
          pulseSpeed={2}
          pulseDensity={0.48}
          cableCount={44}
          thickness={0.38}
          glow={1.25}
          brightness={1.15}
          bend={0.34}
          sway={0.34}
          mouseInteraction={false}
          clickSurge={false}
          dpr={0.85}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-black/35"
        />
        <div className="relative z-10 flex w-full flex-col items-center gap-0 px-3">
          <StrokeWordmark accentColor={accent} compact />
          <p className="mt-[-3px] text-[9px] font-semibold tracking-[0.24em] text-zinc-400 uppercase sm:text-[10px]">
            {resolvedMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <main
      aria-busy="true"
      aria-label={resolvedMessage}
      className="fixed inset-0 z-[9999] isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#08090b] px-6 text-foreground"
    >
      <LightTunnel
        className="absolute inset-0"
        style={tunnelStyle}
        cableColor={accent}
        pulseColor={accent}
        tunnelColor={accent}
        speed={0.11}
        pulseSpeed={2}
        pulseDensity={0.5}
        cableCount={48}
        thickness={0.4}
        glow={1.3}
        brightness={1.18}
        bend={0.38}
        sway={0.4}
        mouseInteraction
        mouseStrength={0.12}
        clickSurge={false}
        dpr={0.85}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_12%,rgba(8,9,11,0.18)_58%,rgba(8,9,11,0.72)_100%)]"
      />
      <div
        role="status"
        aria-live="polite"
        className="relative z-10 flex w-full flex-col items-center gap-4 text-center"
      >
        <StrokeWordmark accentColor={accent} />
        <p className="text-[10px] font-semibold tracking-[0.3em] text-zinc-400 uppercase sm:text-xs">
          {resolvedMessage}
        </p>
      </div>
    </main>
  );
}
