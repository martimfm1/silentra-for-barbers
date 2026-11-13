'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { CalendarDays, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AgendaViewPreference = 'lines' | 'calendar';

const STORAGE_KEY = 'silentra:agenda-view';
const CHANGE_EVENT = 'silentra:agenda-view-change';

export function readAgendaViewPreference(): AgendaViewPreference {
  if (typeof window === 'undefined') return 'lines';
  return window.localStorage.getItem(STORAGE_KEY) === 'calendar'
    ? 'calendar'
    : 'lines';
}

export function saveAgendaViewPreference(view: AgendaViewPreference) {
  window.localStorage.setItem(STORAGE_KEY, view);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAgendaViewPreference() {
  const [view, setView] = useState<AgendaViewPreference>('lines');

  useEffect(() => {
    const read = () => setView(readAgendaViewPreference());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) read();
    };

    read();
    window.addEventListener('storage', handleStorage);
    window.addEventListener(CHANGE_EVENT, read);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CHANGE_EVENT, read);
    };
  }, []);

  const updateView = (nextView: AgendaViewPreference) => {
    saveAgendaViewPreference(nextView);
    setView(nextView);
  };

  return { view, setView: updateView };
}

export function AgendaViewSettings({
  view,
  onChange,
}: {
  view: AgendaViewPreference;
  onChange: (view: AgendaViewPreference) => void;
}) {
  const { locale } = useLanguage();
  const isEnglish = locale === 'en';

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-100">
          {isEnglish ? 'Default agenda view' : 'Vista predefinida da agenda'}
        </p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          {isEnglish
            ? 'Choose what opens when you visit the agenda.'
            : 'Escolhe o que aparece quando abres a agenda.'}
        </p>
      </div>
      <div
        role="group"
        aria-label={isEnglish ? 'Default agenda layout' : 'Layout predefinido da agenda'}
        className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto"
      >
        <Button
          type="button"
          variant="outline"
          aria-pressed={view === 'lines'}
          onClick={() => onChange('lines')}
          className={`h-11 min-w-0 gap-2 border-white/10 px-3 text-xs sm:text-sm ${view === 'lines' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15' : 'bg-white/[.03] text-zinc-300 hover:bg-white/[.07]'}`}
        >
          <List className="size-4 shrink-0" aria-hidden="true" />
          <span>{isEnglish ? 'List' : 'Em linha'}</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={view === 'calendar'}
          onClick={() => onChange('calendar')}
          className={`h-11 min-w-0 gap-2 border-white/10 px-3 text-xs sm:text-sm ${view === 'calendar' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15' : 'bg-white/[.03] text-zinc-300 hover:bg-white/[.07]'}`}
        >
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          <span>{isEnglish ? 'Calendar' : 'Calendário'}</span>
        </Button>
      </div>
    </div>
  );
}
