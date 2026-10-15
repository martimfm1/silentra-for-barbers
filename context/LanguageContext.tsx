'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { pt } from '@/app/locales/pt';
import { en } from '@/app/locales/en';
import { ptCopy } from '@/app/locales/pt-copy';
import { enCopy } from '@/app/locales/en-copy';
import { createClient } from '@/lib/supabase/client';

type Locale = 'pt' | 'en';
type TranslationTree = Record<string, unknown>;

function mergeTranslations(
  base: TranslationTree,
  overrides: TranslationTree,
): TranslationTree {
  const result: TranslationTree = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key];
    if (
      current &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      result[key] = mergeTranslations(
        current as TranslationTree,
        value as TranslationTree,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

const translations = {
  pt: mergeTranslations(pt as TranslationTree, ptCopy as TranslationTree),
  en: mergeTranslations(en as TranslationTree, enCopy as TranslationTree),
} as const;

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, variables?: Record<string, unknown>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

function resolveTranslation(locale: Locale, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (
      current &&
      typeof current === 'object' &&
      Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, translations[locale]);

  return typeof value === 'string' ? value : undefined;
}

function interpolate(value: string, variables?: Record<string, unknown>) {
  if (!variables) return value;
  return Object.entries(variables).reduce(
    (result, [key, val]) => result.replaceAll(`{${key}}`, String(val)),
    value,
  );
}

export function LanguageProvider({
  children,
  initialLocale = 'pt',
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    let active = true;
    const saved = window.localStorage.getItem('locale');
    if (saved === 'pt' || saved === 'en') setLocaleState(saved);

    const syncBarbershopLanguage = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const { data: profile } = await supabase
          .from('users')
          .select('barbershop_id,role')
          .eq('id', user.id)
          .maybeSingle();
        if (
          !profile?.barbershop_id ||
          !['owner', 'admin', 'manager', 'receptionist', 'staff', 'barber', 'professional'].includes(profile.role) ||
          !active
        ) return;
        const { data: shop } = await supabase
          .from('barbershops')
          .select('default_language')
          .eq('id', profile.barbershop_id)
          .maybeSingle();
        if (!active) return;
        const preferred = shop?.default_language === 'en' ? 'en' : shop?.default_language === 'pt' ? 'pt' : null;
        if (preferred) {
          setLocaleState(preferred);
          window.localStorage.setItem('locale', preferred);
          document.cookie = `locale=${preferred}; Path=/; Max-Age=31536000; SameSite=Lax`;
        }
      } catch {
        // Keep the saved browser preference if the profile cannot be loaded.
      }
    };
    void syncBarbershopLanguage();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'pt' ? 'pt-PT' : 'en';
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    window.localStorage.setItem('locale', newLocale);
    document.cookie = `locale=${newLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  const t = useMemo(
    () => (path: string, variables?: Record<string, unknown>) => {
      const translated = resolveTranslation(locale, path);
      if (translated === undefined) return path;
      return interpolate(translated, variables);
    },
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error('useLanguage deve ser usado dentro de um LanguageProvider');
  return context;
}
