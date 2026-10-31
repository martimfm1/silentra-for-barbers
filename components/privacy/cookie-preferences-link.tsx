'use client';

import { Settings2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function CookiePreferencesLink() {
  const { locale } = useLanguage();
  const label =
    locale === 'en'
      ? 'Manage cookie preferences'
      : 'Gerir preferências de cookies';

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new Event('silentra:open-cookie-preferences'))
      }
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-2.5 text-sm font-semibold text-emerald-50 transition hover:border-emerald-200/35 hover:bg-emerald-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
    >
      <Settings2 className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
