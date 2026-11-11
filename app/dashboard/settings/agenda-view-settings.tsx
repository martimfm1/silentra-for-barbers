'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      <Select
        value={view}
        onValueChange={(value) => setView(value as AgendaViewPreference)}
      >
        <SelectTrigger className="h-11 w-full min-w-0 sm:max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="lines">
            {isEnglish ? 'List view' : 'Vista em linhas'}
          </SelectItem>
          <SelectItem value="calendar">
            {isEnglish ? 'Calendar view' : 'Vista em calendário'}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
