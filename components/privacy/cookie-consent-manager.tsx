'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, Settings2, ShieldCheck, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_VERSION,
  parseCookieConsent,
  type CookieConsent,
} from '@/lib/privacy/cookie-consent';

type OptionalChoices = Pick<CookieConsent, 'analytics' | 'marketing'>;

const copy = {
  pt: {
    bannerTitle: 'A tua privacidade importa',
    bannerBody:
      'Usamos cookies necessários para a plataforma funcionar. Só ativamos estatísticas opcionais e ferramentas de marketing depois da tua escolha. Podes alterar as preferências mais tarde.',
    accept: 'Aceitar todas',
    reject: 'Rejeitar opcionais',
    configure: 'Configurar',
    title: 'Preferências de cookies',
    intro:
      'Escolhe as categorias opcionais que autorizas. Os cookies necessários ficam sempre ativos porque permitem prestar o serviço que pediste.',
    necessary: 'Necessários',
    necessaryDesc:
      'Sessão e autenticação, segurança, idioma e memorização da tua escolha de cookies. Não podem ser desativados neste painel.',
    analytics: 'Estatísticas e desempenho',
    analyticsDesc:
      'Permite Vercel Analytics e Speed Insights para medir utilização e desempenho. O Google Tag Manager só é carregado se também autorizares marketing.',
    marketing: 'Marketing e etiquetas de terceiros',
    marketingDesc:
      'Permite o pixel Whop. O contentor Google Tag Manager pode carregar etiquetas de medição e marketing e, por isso, só é carregado quando autorizas também estatísticas.',
    save: 'Guardar preferências',
    cancel: 'Cancelar',
    close: 'Fechar preferências de cookies',
    footer: 'Consulta a',
    policy: 'Política de Cookies',
    settingsSaved:
      'As preferências são aplicadas após recarregar a página. Podes alterá-las na página da Política de Cookies.',
  },
  en: {
    bannerTitle: 'Your privacy matters',
    bannerBody:
      'We use necessary cookies to make the platform work. Optional analytics and marketing tools are activated only after you choose. You can change your preferences later.',
    accept: 'Accept all',
    reject: 'Reject optional',
    configure: 'Configure',
    title: 'Cookie preferences',
    intro:
      'Choose the optional categories you allow. Necessary cookies remain active because they provide the service you requested.',
    necessary: 'Necessary',
    necessaryDesc:
      'Session and authentication, security, language, and remembering your cookie choice. These cannot be disabled here.',
    analytics: 'Analytics and performance',
    analyticsDesc:
      'Allows Vercel Analytics and Speed Insights to measure usage and performance. Google Tag Manager loads only if you also allow marketing.',
    marketing: 'Marketing and third-party tags',
    marketingDesc:
      'Allows the Whop pixel. The Google Tag Manager container can load measurement and marketing tags, so it loads only when analytics is also allowed.',
    save: 'Save preferences',
    cancel: 'Cancel',
    close: 'Close cookie preferences',
    footer: 'Read the',
    policy: 'Cookie Policy',
    settingsSaved:
      'Preferences take effect after the page reloads. You can change them from the Cookie Policy page.',
  },
} as const;

function readStoredConsent(): CookieConsent | null {
  if (typeof document === 'undefined') return null;
  const item = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`));
  return parseCookieConsent(item?.slice(COOKIE_CONSENT_COOKIE.length + 1));
}

function persistConsent(choices: OptionalChoices) {
  const consent: CookieConsent = {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
    updatedAt: new Date().toISOString(),
  };
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;

  // A full navigation makes server-rendered third-party scripts follow the new
  // server-validated preference, including when consent is withdrawn.
  window.location.reload();
}

export function CookieConsentManager() {
  const { locale } = useLanguage();
  const t = copy[locale === 'en' ? 'en' : 'pt'];
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<CookieConsent | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draft, setDraft] = useState<OptionalChoices>({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const stored = readStoredConsent();
    setSaved(stored);
    setDraft({
      analytics: stored?.analytics ?? false,
      marketing: stored?.marketing ?? false,
    });
    setReady(true);
  }, []);

  useEffect(() => {
    const openFromCookiePolicy = () => {
      const stored = readStoredConsent();
      setSaved(stored);
      setDraft({
        analytics: stored?.analytics ?? false,
        marketing: stored?.marketing ?? false,
      });
      setPreferencesOpen(true);
    };

    window.addEventListener('silentra:open-cookie-preferences', openFromCookiePolicy);
    return () =>
      window.removeEventListener('silentra:open-cookie-preferences', openFromCookiePolicy);
  }, []);

  if (!ready) return null;

  const openPreferences = () => {
    setDraft({
      analytics: saved?.analytics ?? false,
      marketing: saved?.marketing ?? false,
    });
    setPreferencesOpen(true);
  };

  const saveChoices = (choices: OptionalChoices) => persistConsent(choices);

  return (
    <>
      {!saved && !preferencesOpen ? (
        <aside
          aria-label={t.bannerTitle}
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-[120] mx-auto max-w-5xl rounded-2xl border border-white/15 bg-zinc-950/95 p-4 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:inset-x-5 sm:bottom-5 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-xl border border-white/10 bg-white/[0.06] p-2 text-emerald-200">
              <Cookie className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">{t.bannerTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-300">
                {t.bannerBody}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t.footer}{' '}
                <Link
                  className="underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  href="/cookies"
                >
                  {t.policy}
                </Link>
                .
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => saveChoices({ analytics: true, marketing: true })}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  {t.accept}
                </button>
                <button
                  type="button"
                  onClick={() => saveChoices({ analytics: false, marketing: false })}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  {t.reject}
                </button>
                <button
                  type="button"
                  onClick={openPreferences}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <Settings2 className="size-4" aria-hidden="true" />
                  {t.configure}
                </button>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {preferencesOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && saved) {
              setPreferencesOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-preferences-title"
            className="max-h-[min(90dvh,760px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-zinc-950 p-5 text-zinc-100 shadow-2xl shadow-black/60 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Silentra for Barbers
                </div>
                <h2 id="cookie-preferences-title" className="mt-3 text-2xl font-semibold tracking-tight">
                  {t.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreferencesOpen(false)}
                aria-label={t.close}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{t.intro}</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="cookie-necessary"
                    type="checkbox"
                    checked
                    disabled
                    aria-label={t.necessary}
                    className="mt-1 size-4 accent-emerald-300"
                  />
                  <div>
                    <label htmlFor="cookie-necessary" className="font-medium text-zinc-100">
                      {t.necessary}
                    </label>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{t.necessaryDesc}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="cookie-analytics"
                    type="checkbox"
                    checked={draft.analytics}
                    onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))}
                    className="mt-1 size-4 accent-emerald-300"
                  />
                  <div className="min-w-0">
                    <label htmlFor="cookie-analytics" className="font-medium text-zinc-100">
                      {t.analytics}
                    </label>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{t.analyticsDesc}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="cookie-marketing"
                    type="checkbox"
                    checked={draft.marketing}
                    onChange={(event) => setDraft((current) => ({ ...current, marketing: event.target.checked }))}
                    className="mt-1 size-4 accent-emerald-300"
                  />
                  <div className="min-w-0">
                    <label htmlFor="cookie-marketing" className="font-medium text-zinc-100">
                      {t.marketing}
                    </label>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{t.marketingDesc}</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-500">{t.settingsSaved}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => saveChoices(draft)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                {t.save}
              </button>
              <button
                type="button"
                onClick={() => setPreferencesOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                {t.cancel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
