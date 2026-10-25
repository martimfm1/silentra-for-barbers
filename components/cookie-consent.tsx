'use client';

import { useEffect, useState } from 'react';
import { Cookie, Settings2, X } from 'lucide-react';

type Consent = { necessary: true; analytics: boolean; marketing: boolean; updatedAt: string };
const STORAGE_KEY = 'silentra-cookie-consent-v1';

function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Consent>;
    if (typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean') return null;
    return { necessary: true, analytics: value.analytics, marketing: value.marketing, updatedAt: value.updatedAt ?? '' };
  } catch { return null; }
}

function saveConsent(analytics: boolean, marketing: boolean) {
  const consent: Consent = { necessary: true, analytics, marketing, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent('silentra:consent-updated', { detail: consent }));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [locale, setLocale] = useState<'pt' | 'en'>('pt');

  useEffect(() => {
    const stored = readConsent();
    if (stored) {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
    } else setVisible(true);
    const language = document.cookie.split('; ').find((item) => item.startsWith('locale='))?.split('=')[1];
    if (language === 'en') setLocale('en');
    const openSettings = () => { setSettings(true); setVisible(true); };
    window.addEventListener('silentra:open-cookie-settings', openSettings);
    return () => window.removeEventListener('silentra:open-cookie-settings', openSettings);
  }, []);

  const en = locale === 'en';
  const acceptAll = () => { saveConsent(true, true); setAnalytics(true); setMarketing(true); setVisible(false); setSettings(false); };
  const rejectOptional = () => { saveConsent(false, false); setAnalytics(false); setMarketing(false); setVisible(false); setSettings(false); };
  const savePreferences = () => { saveConsent(analytics, marketing); setVisible(false); setSettings(false); };

  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-2xl border border-white/15 bg-zinc-950/95 p-5 text-zinc-100 shadow-2xl backdrop-blur-2xl sm:inset-x-6 sm:bottom-6 sm:p-6" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-300"><Cookie className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 id="cookie-title" className="text-lg font-semibold tracking-tight">{en ? 'Your privacy matters' : 'A tua privacidade importa'}</h2>
            <button type="button" onClick={rejectOptional} aria-label={en ? 'Reject optional cookies' : 'Rejeitar cookies opcionais'} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {en ? 'We use essential storage to keep Silentra secure and working. With your permission, we also use analytics and marketing technologies. You can change your choice at any time.' : 'Utilizamos armazenamento essencial para manter a Silentra segura e funcional. Com a tua autorização, também usamos tecnologias de análise e marketing. Podes alterar a tua escolha a qualquer momento.'}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-400">
            {en ? 'Essential technologies are always active. Optional categories remain off until you consent.' : 'As tecnologias essenciais estão sempre ativas. As categorias opcionais ficam desligadas até dares consentimento.'}{' '}
            <a className="underline underline-offset-4 hover:text-white" href="/privacy">{en ? 'Privacy policy' : 'Política de Privacidade'}</a>
            {' · '}<a className="underline underline-offset-4 hover:text-white" href="/terms">{en ? 'Terms' : 'Termos'}</a>
          </p>
          {settings && <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-4 text-sm"><div><p className="font-medium">{en ? 'Essential' : 'Essenciais'}</p><p className="text-xs text-zinc-400">{en ? 'Security, session and core features' : 'Segurança, sessão e funcionalidades base'}</p></div><span className="text-xs text-emerald-300">{en ? 'Always on' : 'Sempre ativos'}</span></div>
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm"><span><span className="block font-medium">{en ? 'Analytics' : 'Análise'}</span><span className="block text-xs text-zinc-400">{en ? 'Understand usage and improve performance' : 'Compreender a utilização e melhorar o desempenho'}</span></span><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="size-4 accent-emerald-400" /></label>
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm"><span><span className="block font-medium">{en ? 'Marketing' : 'Marketing'}</span><span className="block text-xs text-zinc-400">{en ? 'Advertising and campaign measurement' : 'Publicidade e medição de campanhas'}</span></span><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="size-4 accent-emerald-400" /></label>
          </div>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button type="button" onClick={rejectOptional} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10">{en ? 'Reject optional' : 'Rejeitar opcionais'}</button>
            <button type="button" onClick={() => setSettings((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"><Settings2 className="size-4" />{settings ? (en ? 'Hide settings' : 'Ocultar opções') : (en ? 'Customise' : 'Personalizar')}</button>
            {settings ? <button type="button" onClick={savePreferences} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">{en ? 'Save preferences' : 'Guardar preferências'}</button> : <button type="button" onClick={acceptAll} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300">{en ? 'Accept all' : 'Aceitar tudo'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event('silentra:open-cookie-settings'))} className="underline underline-offset-4 hover:text-white">{'Preferências de cookies'}</button>;
}
