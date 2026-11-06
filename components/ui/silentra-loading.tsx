'use client';

import { useLanguage } from '@/context/LanguageContext';

export type SilentraLoaderProps = {
  /** Texto apresentado por baixo da marca. */
  label?: string;
  /** Ocupa o ecrã inteiro ou apenas o contentor pai. */
  fullscreen?: boolean;
  /** Layout compacto para secções e cartões. */
  compact?: boolean;
  className?: string;
};

type SilentraLoadingProps = SilentraLoaderProps & {
  variant?: 'fullscreen' | 'compact' | 'dashboard';
  message?: string;
};

/**
 * Loader de marca da Silentra for Barbers.
 * O arco completa uma volta em 3s e as tesouras executam dois movimentos de corte.
 * A animação respeita prefers-reduced-motion e adapta-se a layouts compactos.
 */
export function SilentraLoader({
  label,
  fullscreen = true,
  compact = false,
  className = '',
}: SilentraLoaderProps) {
  const { locale } = useLanguage();
  const resolvedLabel =
    label ??
    (locale === 'en' ? 'Preparing your experience' : 'A preparar a experiência');

  const rootClassName = [
    'sl-root',
    compact ? 'sl-compact' : fullscreen ? 'sl-fullscreen' : 'sl-inline',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={resolvedLabel}
      className={rootClassName}
    >
      <div className="sl-ring-wrap" aria-hidden="true">
        <div className="sl-track" />
        <div className="sl-arc" />
        <svg
          className="sl-scissors"
          viewBox="-40 -100 80 220"
          focusable="false"
          aria-hidden="true"
        >
          <g className="sl-blade sl-blade-a">
            <path d="M0 -78 L9 -6 L7 16 L0 16 Z M0 10 L9 10 L14 52 L7 52 Z" />
            <circle cx="14" cy="74" r="17" className="sl-handle" />
          </g>
          <g className="sl-blade sl-blade-b">
            <path d="M0 -78 L-9 -6 L-7 16 L0 16 Z M0 10 L-9 10 L-14 52 L-7 52 Z" />
            <circle cx="-14" cy="74" r="17" className="sl-handle" />
          </g>
          <circle r="5" className="sl-pivot" />
        </svg>
      </div>

      <div className="sl-brand">
        <p className="sl-word">SILENTRA</p>
        <p className="sl-tag">FOR BARBERS</p>
        <p className="sl-label">
          <span>{resolvedLabel}</span>
          <span className="sl-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      </div>

      <style>{`
        .sl-root {
          --sl-bg: #09090b;
          --sl-fg: #fafafa;
          --sl-muted: #8a8a93;
          --sl-track: #27272a;
          --sl-cycle: 3s;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          width: 100%;
          min-width: 0;
          color: var(--sl-fg);
          font-family: inherit;
          text-align: center;
          isolation: isolate;
        }
        .sl-fullscreen {
          position: fixed;
          inset: 0;
          z-index: 9999;
          min-height: 100vh;
          min-height: 100dvh;
          overflow: hidden;
          padding: max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
          background:
            radial-gradient(ellipse at 50% 42%, rgba(255,255,255,.055), transparent 42%),
            var(--sl-bg);
        }
        .sl-inline {
          position: relative;
          min-height: clamp(240px, 42vh, 320px);
          overflow: hidden;
          padding: 24px 16px;
          background: transparent;
        }
        .sl-ring-wrap {
          position: relative;
          flex: 0 0 auto;
          width: clamp(164px, 24vw, 232px);
          aspect-ratio: 1;
        }
        .sl-track {
          position: absolute;
          inset: 0;
          border: 3px solid var(--sl-track);
          border-radius: 50%;
        }
        .sl-arc {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0 30%, var(--sl-fg) 100%);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
          filter: drop-shadow(0 0 9px rgba(212, 212, 220, .3));
          animation: sl-spin var(--sl-cycle) linear infinite;
        }
        .sl-scissors {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 31%;
          height: 88%;
          overflow: visible;
          transform: translate(-50%, -52%) scale(.86);
        }
        .sl-scissors path,
        .sl-pivot {
          fill: var(--sl-fg);
        }
        .sl-pivot {
          fill: var(--sl-bg);
        }
        .sl-handle {
          fill: none;
          stroke: var(--sl-fg);
          stroke-width: 6;
        }
        .sl-blade {
          transform-box: view-box;
          transform-origin: 0 0;
        }
        .sl-blade-a {
          animation: sl-cut-a calc(var(--sl-cycle) / 2) ease-in-out infinite;
        }
        .sl-blade-b {
          animation: sl-cut-b calc(var(--sl-cycle) / 2) ease-in-out infinite;
        }
        .sl-brand {
          display: flex;
          min-width: 0;
          flex-direction: column;
          align-items: center;
        }
        .sl-word {
          margin: clamp(20px, 3vh, 28px) 0 0;
          padding-left: .42em;
          font-size: clamp(24px, 4.4vw, 34px);
          font-weight: 650;
          letter-spacing: .42em;
          line-height: 1.1;
          white-space: nowrap;
        }
        .sl-tag {
          margin: 9px 0 0;
          padding-left: .52em;
          color: var(--sl-muted);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .52em;
          line-height: 1.4;
        }
        .sl-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          max-width: min(100%, 420px);
          margin: clamp(22px, 4vh, 34px) 0 0;
          color: var(--sl-muted);
          font-size: clamp(12px, 2.5vw, 15px);
          line-height: 1.5;
          text-wrap: balance;
        }
        .sl-dots {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 5px;
        }
        .sl-dots i {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--sl-muted);
          opacity: .25;
          animation: sl-dot calc(var(--sl-cycle) / 2) ease-in-out infinite;
        }
        .sl-dots i:nth-child(2) { animation-delay: .18s; }
        .sl-dots i:nth-child(3) { animation-delay: .36s; }

        .sl-compact {
          min-height: 88px;
          flex-direction: row;
          justify-content: center;
          gap: 13px;
          padding: 12px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(255,255,255,.035), rgba(255,255,255,.012));
          text-align: left;
        }
        .sl-compact .sl-ring-wrap {
          width: 56px;
          height: 56px;
        }
        .sl-compact .sl-track { border-width: 2px; }
        .sl-compact .sl-arc {
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
          filter: drop-shadow(0 0 5px rgba(212, 212, 220, .24));
        }
        .sl-compact .sl-scissors {
          width: 29%;
          height: 82%;
          transform: translate(-50%, -52%) scale(.88);
        }
        .sl-compact .sl-brand {
          align-items: flex-start;
          text-align: left;
        }
        .sl-compact .sl-word {
          margin: 0;
          padding: 0;
          font-size: 15px;
          letter-spacing: .25em;
        }
        .sl-compact .sl-tag {
          margin: 3px 0 0;
          padding: 0;
          font-size: 8px;
          letter-spacing: .34em;
        }
        .sl-compact .sl-label {
          justify-content: flex-start;
          gap: 7px;
          margin: 7px 0 0;
          font-size: 10px;
          line-height: 1.3;
        }
        .sl-compact .sl-dots { gap: 3px; }
        .sl-compact .sl-dots i { width: 3px; height: 3px; }

        @keyframes sl-spin { to { transform: rotate(360deg); } }
        @keyframes sl-cut-a { 0%,100% { transform: rotate(22deg); } 50% { transform: rotate(4deg); } }
        @keyframes sl-cut-b { 0%,100% { transform: rotate(-22deg); } 50% { transform: rotate(-4deg); } }
        @keyframes sl-dot { 0%,100% { opacity: .25; } 50% { opacity: 1; } }

        @media (max-width: 480px) {
          .sl-ring-wrap { width: min(58vw, 192px); }
          .sl-word { letter-spacing: .32em; padding-left: .32em; }
          .sl-tag { letter-spacing: .42em; padding-left: .42em; }
          .sl-label { margin-top: 22px; }
          .sl-compact { gap: 10px; padding: 10px; }
          .sl-compact .sl-ring-wrap { width: 48px; height: 48px; }
          .sl-compact .sl-word { font-size: 13px; letter-spacing: .2em; }
          .sl-compact .sl-tag { font-size: 7px; letter-spacing: .28em; }
          .sl-compact .sl-label { font-size: 9px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sl-arc, .sl-blade, .sl-dots i { animation: none !important; }
          .sl-blade-a { transform: rotate(13deg); }
          .sl-blade-b { transform: rotate(-13deg); }
          .sl-dots i { opacity: .6; }
        }
      `}</style>
    </div>
  );
}

/** Backwards-compatible API used by existing route and dashboard loading boundaries. */
export function SilentraLoading({
  variant = 'fullscreen',
  message,
  label,
  fullscreen,
  className,
}: SilentraLoadingProps) {
  const { locale } = useLanguage();
  const compact = variant === 'compact';
  const resolvedLabel =
    label ??
    message ??
    (variant === 'dashboard'
      ? locale === 'en' ? 'Preparing your dashboard' : 'A preparar a tua dashboard'
      : compact
        ? locale === 'en' ? 'Loading…' : 'A carregar…'
        : locale === 'en' ? 'Preparing your experience' : 'A preparar a experiência');

  return (
    <SilentraLoader
      label={resolvedLabel}
      fullscreen={fullscreen ?? !compact}
      compact={compact}
      className={className}
    />
  );
}

export default SilentraLoading;
