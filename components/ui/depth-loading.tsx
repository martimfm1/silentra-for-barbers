'use client';

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import type { PointerEvent } from 'react';

type DepthLoadingProps = {
  message?: string;
  variant?: 'fullscreen' | 'compact';
};

const SPRING = {
  stiffness: 190,
  damping: 24,
  mass: 0.55,
} as const;

const DEPTH_LAYERS = Array.from({ length: 7 }, (_, index) => index + 1);

/**
 * Silentra's shared loading treatment.
 *
 * The layered wordmark takes inspiration from React Bits' Depth Text:
 * dimensional lettering, a restrained 3D tilt and pointer parallax.
 * The effect stays lightweight (CSS transforms + Motion) and has a static
 * presentation for users who prefer reduced motion.
 */
export function DepthLoading({
  message = 'A preparar a experiência',
  variant = 'fullscreen',
}: DepthLoadingProps) {
  const prefersReducedMotion = useReducedMotion();
  const targetRotateX = useMotionValue(0);
  const targetRotateY = useMotionValue(0);
  const rotateX = useSpring(targetRotateX, SPRING);
  const rotateY = useSpring(targetRotateY, SPRING);
  const isCompact = variant === 'compact';

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || event.pointerType !== 'mouse') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    const intensity = isCompact ? 7 : 13;

    targetRotateX.set(y * -intensity);
    targetRotateY.set(x * intensity);
  };

  const resetPointer = () => {
    targetRotateX.set(0);
    targetRotateY.set(0);
  };

  const wordmark = (
    <div
      className="relative select-none"
      style={{ perspective: 900, transformStyle: 'preserve-3d' }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <motion.div
        className="relative"
        style={{
          rotateX: prefersReducedMotion ? 0 : rotateX,
          rotateY: prefersReducedMotion ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={prefersReducedMotion ? { y: 0 } : { y: [0, -2, 0] }}
        transition={{
          duration: 4.8,
          repeat: prefersReducedMotion ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      >
        {DEPTH_LAYERS.map((layer) => (
          <span
            key={layer}
            aria-hidden="true"
            className={[
              'absolute inset-0 block whitespace-nowrap font-heading font-black leading-none tracking-[0.22em]',
              isCompact ? 'text-xl' : 'text-[clamp(2.1rem,6vw,4.25rem)]',
            ].join(' ')}
            style={{
              color:
                'color-mix(in srgb, var(--dashboard-accent, var(--primary)) 72%, transparent)',
              opacity: 0.9 - layer * 0.085,
              transform: `translate3d(0, ${layer * 1.35}px, ${-layer * 3.2}px)`,
              WebkitTextStroke:
                '0.5px color-mix(in srgb, var(--dashboard-accent, var(--primary)) 64%, transparent)',
            }}
          >
            SILENTRA
          </span>
        ))}
        <span
          aria-hidden="true"
          className={[
            'relative block whitespace-nowrap font-heading font-black leading-none tracking-[0.22em] text-foreground',
            isCompact ? 'text-xl' : 'text-[clamp(2.1rem,6vw,4.25rem)]',
          ].join(' ')}
          style={{
            transform: 'translate3d(0, 0, 1px)',
            textShadow:
              '0 12px 32px color-mix(in srgb, var(--dashboard-accent, var(--primary)) 24%, transparent)',
          }}
        >
          SILENTRA
        </span>
      </motion.div>
    </div>
  );

  if (isCompact) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={message}
        className="flex min-w-0 items-center gap-3 py-1"
      >
        <div aria-hidden="true" className="shrink-0">
          {wordmark}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            {message}
          </p>
          <div className="mt-2 h-px w-24 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full w-1/2 rounded-full bg-[var(--dashboard-accent,var(--primary))]"
              animate={
                prefersReducedMotion ? { x: 0 } : { x: ['-110%', '210%'] }
              }
              transition={{
                duration: 1.6,
                repeat: prefersReducedMotion ? 0 : Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
      className="fixed inset-0 z-[9999] flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#08090b] px-6 text-center text-foreground"
      style={{
        background:
          'radial-gradient(ellipse at 50% 46%, color-mix(in srgb, var(--dashboard-accent, var(--primary)) 12%, transparent), transparent 43%), #08090b',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(255 255 255 / 0.025) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.025) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse at center, black 12%, transparent 72%)',
        }}
      />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute size-[min(76vw,34rem)] rounded-full border border-white/[0.055]"
        animate={
          prefersReducedMotion
            ? { rotate: 0, opacity: 0.28 }
            : { rotate: 360, opacity: [0.2, 0.42, 0.2] }
        }
        transition={{
          duration: 26,
          repeat: prefersReducedMotion ? 0 : Infinity,
          ease: 'linear',
        }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute size-[min(56vw,24rem)] rounded-full border border-white/[0.045]"
        animate={
          prefersReducedMotion
            ? { rotate: 0, opacity: 0.2 }
            : { rotate: -360, opacity: [0.14, 0.32, 0.14] }
        }
        transition={{
          duration: 32,
          repeat: prefersReducedMotion ? 0 : Infinity,
          ease: 'linear',
        }}
      />

      <div className="relative flex flex-col items-center">
        <motion.div
          aria-hidden="true"
          className="absolute -inset-x-10 -inset-y-8 rounded-full bg-[var(--dashboard-accent,var(--primary))]/[0.07] blur-3xl"
          animate={
            prefersReducedMotion
              ? { opacity: 0.35, scale: 1 }
              : { opacity: [0.22, 0.55, 0.22], scale: [0.94, 1.06, 0.94] }
          }
          transition={{
            duration: 3.8,
            repeat: prefersReducedMotion ? 0 : Infinity,
            ease: 'easeInOut',
          }}
        />

        {wordmark}

        <div className="mt-9 h-px w-40 overflow-hidden rounded-full bg-white/10 sm:w-48">
          <motion.div
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-[var(--dashboard-accent,var(--primary))] to-transparent"
            animate={
              prefersReducedMotion ? { x: 0 } : { x: ['-110%', '210%'] }
            }
            transition={{
              duration: 1.7,
              repeat: prefersReducedMotion ? 0 : Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        <p className="mt-5 text-[10px] font-semibold tracking-[0.28em] text-muted-foreground uppercase sm:text-xs">
          {message}
        </p>
        <div aria-hidden="true" className="mt-4 flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="size-1 rounded-full bg-[var(--dashboard-accent,var(--primary))]"
              animate={
                prefersReducedMotion
                  ? { opacity: 0.65, y: 0 }
                  : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }
              }
              transition={{
                duration: 1.1,
                delay: dot * 0.16,
                repeat: prefersReducedMotion ? 0 : Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
