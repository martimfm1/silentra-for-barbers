'use client';

import { useEffect, useRef } from 'react';
import { lockBodyScroll } from '@/lib/ui/body-scroll-lock';

type ElementRef<T extends HTMLElement> = {
  current: T | null;
};

type UseAccessibleDialogOptions<T extends HTMLElement> = {
  open: boolean;
  dialogRef: ElementRef<T>;
  onClose: () => void;
  restoreFocusRef?: ElementRef<HTMLElement>;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Adds the keyboard and focus behaviour expected from a modal dialog:
 * initial focus, a contained Tab sequence, Escape handling, focus restoration
 * and background scroll locking.
 */
export function useAccessibleDialog<T extends HTMLElement>({
  open,
  dialogRef,
  onClose,
  restoreFocusRef,
}: UseAccessibleDialogOptions<T>) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const unlockBodyScroll = lockBodyScroll();

    const getFocusableElements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.getAttribute('aria-hidden') !== 'true' &&
          element.getAttribute('aria-disabled') !== 'true' &&
          element.getClientRects().length > 0 &&
          window.getComputedStyle(element).visibility !== 'hidden',
      );

    const focusInitialElement = () => {
      const focusableElements = getFocusableElements();
      const preferred = dialog.querySelector<HTMLElement>(
        '[data-dialog-initial-focus], [autofocus]',
      );
      const target =
        (preferred && focusableElements.includes(preferred)
          ? preferred
          : null) ??
        focusableElements[0] ??
        dialog;
      target.focus();
    };

    const animationFrame = window.requestAnimationFrame(focusInitialElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusOutsideDialog = !dialog.contains(activeElement);

      if (event.shiftKey && (activeElement === first || focusOutsideDialog)) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || focusOutsideDialog)
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      unlockBodyScroll();

      const fallback = restoreFocusRef?.current;
      const target =
        previouslyFocused?.isConnected
          ? previouslyFocused
          : fallback?.isConnected
            ? fallback
            : null;
      target?.focus();
    };
  }, [dialogRef, open, restoreFocusRef]);
}
