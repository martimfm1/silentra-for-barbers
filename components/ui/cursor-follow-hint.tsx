'use client';

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';

const FOLLOW_SPRING = {
  stiffness: 500,
  damping: 50,
  bounce: 0,
} as const;

/**
 * Small contextual hover label inspired by Animate UI's CursorFollow.
 * It never replaces the native pointer and only activates on fine pointers.
 */
export function CursorFollowHint() {
  const prefersReducedMotion = useReducedMotion();
  const pointerX = useMotionValue(-100);
  const pointerY = useMotionValue(-100);
  const x = useSpring(pointerX, FOLLOW_SPRING);
  const y = useSpring(pointerY, FOLLOW_SPRING);
  const [label, setLabel] = useState('');
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const labelRef = useRef('');

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!canHover.matches) return;

    const hide = () => {
      if (!visibleRef.current) return;
      visibleRef.current = false;
      setVisible(false);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.buttons !== 0) {
        hide();
        return;
      }

      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-cursor-label]')
          : null;
      const nextLabel = target?.dataset.cursorLabel?.trim();

      if (!target || !nextLabel) {
        hide();
        return;
      }

      if (labelRef.current !== nextLabel) {
        labelRef.current = nextLabel;
        setLabel(nextLabel);
      }

      pointerX.set(event.clientX + 18);
      pointerY.set(event.clientY + 18);
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) hide();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerout', handlePointerOut, { passive: true });
    window.addEventListener('blur', hide);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('blur', hide);
    };
  }, [pointerX, pointerY, prefersReducedMotion]);

  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.78,
      }}
      transition={{
        opacity: { duration: 0.16, ease: 'easeOut' },
        scale: FOLLOW_SPRING,
      }}
      style={{ x, y }}
      className="pointer-events-none fixed left-0 top-0 z-[10002] hidden -translate-y-1/2 items-center rounded-full border border-emerald-300/20 bg-zinc-950/95 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-emerald-100 shadow-[0_8px_28px_rgba(0,0,0,0.38)] backdrop-blur-xl md:flex"
    >
      {label}
    </motion.div>
  );
}
