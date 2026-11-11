'use client';

import { useEffect, type ReactNode } from 'react';
import {
  triggerHapticFeedback,
  type HapticFeedback,
} from '@/lib/haptics';

function isHapticFeedback(value: string | undefined): value is HapticFeedback {
  return (
    value === 'selection' ||
    value === 'success' ||
    value === 'warning' ||
    value === 'error'
  );
}

/**
 * Handles haptics through event delegation so server-rendered buttons and
 * links can opt in without adding client-side event handlers to each one.
 */
export function HapticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const target = event.target.closest<HTMLElement>('[data-haptic]');
      if (
        !target ||
        target.hasAttribute('disabled') ||
        target.getAttribute('aria-disabled') === 'true'
      ) {
        return;
      }

      const feedback = target.dataset.haptic;
      if (isHapticFeedback(feedback)) {
        triggerHapticFeedback(feedback);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return children;
}
