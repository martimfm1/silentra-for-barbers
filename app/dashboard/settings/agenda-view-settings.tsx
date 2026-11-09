'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, List } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AgendaViewPreference = 'lines' | 'calendar';

const STORAGE_KEY = 'silentra:agenda-view';
const CHANGE_EVENT = 'silentra:agenda-view-change';

export function useAgendaViewPreference() {
  const [view, setView] = useState<AgendaViewPreference>('lines');

  useEffect(() => {
    const readPreference = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setView(stored === 'calendar' ? 'calendar' : 'lines');
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) readPreference();
    };

    readPreference();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CHANGE_EVENT, readPreference);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CHANGE_EVENT, readPreference);
    };
  }, []);

  const updateView = (nextView: AgendaViewPreference) => {
    window.localStorage.setItem(STORAGE_KEY, nextView);
    setView(nextView);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return { view, setView: updateView };
}

export function AgendaViewSettings() {
  const { locale } = useLanguage();
  const { view, setView } = useAgendaViewPreference();
  const isEnglish = locale === 'en';

  const options = [
    {
      value: 'lines' as const,
      title: isEnglish ? 'List view' : 'Vista em linhas',
      description: isEnglish
        ? 'Keep the familiar appointment list with search and filters.'
        : 'Mantém a lista de marcações com pesquisa e filtros.',
      Icon: List,
    },
    {
      value: 'calendar' as const,
      title: isEnglish ? 'Calendar view' : 'Vista em calendário',
      description: isEnglish
        ? 'See the month, daily workload, bookings, days off and blocked times.'
        : 'Consulta o mês, a carga diária, marcações, folgas e bloqueios.',
      Icon: CalendarDays,
    },
  ];

  return (
    <section className="mt-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {isEnglish ? 'Agenda display' : 'Apresentação da agenda'}
        </h2>
        <p className="text-sm leading-5 text-zinc-500">
          {isEnglish
            ? 'Choose the view that should always open when you visit your agenda. You can change it here at any time.'
            : 'Escolhe a vista que deve abrir sempre que entrares na agenda. Podes alterá-la aqui quando quiseres.'}
        </p>
      </div>
      <Card className="border border-white/10 bg-white/[.02] text-zinc-50">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          {options.map(({ value, title, description, Icon }) => {
            const selected = view === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setView(value)}
                className={cn(
                  'flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                  selected
                    ? 'border-emerald-400/40 bg-emerald-400/[.08] text-zinc-50'
                    : 'border-white/10 bg-white/[.02] text-zinc-400 hover:border-white/20 hover:bg-white/[.045]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl',
                    selected
                      ? 'bg-emerald-400/15 text-emerald-300'
                      : 'bg-white/[.05] text-zinc-400',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {title}
                    {selected && (
                      <span className="size-2 rounded-full bg-emerald-400" />
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">
                    {description}
                  </span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>
      <p className="text-xs text-zinc-600">
        {isEnglish
          ? 'This preference is saved in this browser and stays selected between visits.'
          : 'Esta preferência fica guardada neste navegador e mantém-se entre visitas.'}
      </p>
    </section>
  );
}
