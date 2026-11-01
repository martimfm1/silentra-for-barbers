let activeLocks = 0;
let restoreScrollLock: (() => void) | null = null;

/**
 * Locks the document behind modal overlays, including iOS Safari where
 * overflow:hidden on body alone does not reliably prevent background scroll.
 * Multiple overlays can safely hold a lock at the same time.
 */
export function lockBodyScroll(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return () => {};

  if (activeLocks === 0) {
    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const previous = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';

    restoreScrollLock = () => {
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      body.style.overflow = previous.bodyOverflow;
      root.style.overflow = previous.rootOverflow;
      root.style.overscrollBehavior = previous.rootOverscrollBehavior;
      window.scrollTo(0, scrollY);
      restoreScrollLock = null;
    };
  }

  activeLocks += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks === 0) restoreScrollLock?.();
  };
}
