'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { SilentraLoader } from '@/components/ui/silentra-loading';

export function IntroLoader({ onComplete }: { onComplete: () => void }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
      onComplete();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isLoading ? (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center bg-[#09090b]"
        >
          <SilentraLoader fullscreen={false} className="min-h-dvh" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
