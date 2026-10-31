'use client';

import { useEffect } from 'react';

export function PwaRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // PWA installation remains available through the browser without a worker.
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
