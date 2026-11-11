'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CalendarDays } from 'lucide-react';
import { useAgendaViewPreference } from '../settings/agenda-view-settings';

export default function AgendaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const reduceMotion = useReducedMotion();
  const { view } = useAgendaViewPreference();

  return (
    <div className="relative mt-12 w-full min-w-0">
      {view !== 'calendar' ? (
        <div className="mx-auto mb-3 flex w-full max-w-[100rem] items-center gap-3 px-1 sm:px-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300 shadow-[0_10px_30px_rgba(16,185,129,0.08)]">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="silentra-page-title">Agenda</h1>
            <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
              Gere e visualiza todas as tuas marcações e horários.
            </p>
          </div>
        </div>
      ) : null}

      <motion.div
        key="agenda"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.22, ease: 'easeOut' }}
        className="min-w-0"
      >
        {children}
      </motion.div>
    </div>
  );
}
