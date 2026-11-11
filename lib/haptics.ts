'use client';

import { useCallback } from 'react';

export type HapticFeedback = 'selection' | 'success' | 'warning' | 'error';

const HAPTIC_PATTERNS: Record<HapticFeedback, VibratePattern> = {
  selection: 8,
  success: [12, 30, 12],
  warning: [18, 48, 18],
  error: [24, 56, 24],
};

/**
 * Triggers a small, semantic haptic pattern when the browser supports it.
 * Returns false when the API is unavailable or the browser rejects the request.
 */
export function triggerHapticFeedback(
  feedback: HapticFeedback = 'selection',
): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!('vibrate' in navigator)) return false;

  try {
    return navigator.vibrate(HAPTIC_PATTERNS[feedback]);
  } catch {
    return false;
  }
}

/** React hook for calling haptics from event handlers and async UI flows. */
export function useHaptics() {
  return useCallback(
    (feedback: HapticFeedback = 'selection') =>
      triggerHapticFeedback(feedback),
    [],
  );
}
