'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  FileText,
  Mail,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

type Locale = 'pt' | 'en';

type LocalizedText = Record<Locale, string>;

type LegalSection = {
  title: string;
  paragraphs: readonly string[];
};

type LegalDocument = {
  lastUpdated: string;
  intro: string;
  sections: readonly LegalSection[];
};

type Highlight = {
  label: LocalizedText;
  value: LocalizedText;
  icon?: React.ReactNode;
};

type LegalDocumentPageProps = {
  pageLabel: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  documentByLocale: Record<Locale, LegalDocument>;
  highlights: Highlight[];
  headerAction?: React.ReactNode;
  supportLabel: LocalizedText;
  supportValue: string;
  backLabel: LocalizedText;
};

const SILENTRA_CONTACT_EMAIL = 'silentra.contact@gmail.com';

const normalizeContactText = (value: string) =>
  value.replace(/contact@silentra\.me/gi, SILENTRA_CONTACT_EMAIL);

const ui = {
  pt: {
    updated: 'Última atualização',
    quickFacts: 'Factos rápidos',
    contents: 'Nesta página',
    contact: 'Contacto',
    introBadge: 'Documento legal',
    goHome: 'Voltar à home',
    supportHint:
      'Se precisas de um DPA, revisão jurídica ou clarificação contratual, responde diretamente por email.',
  },
  en: {
    updated: 'Last updated',
    quickFacts: 'Quick facts',
    contents: 'On this page',
    contact: 'Contact',
    introBadge: 'Legal document',
    goHome: 'Back home',
    supportHint:
      'If you need a DPA, legal review, or contractual clarification, reply directly by email.',
  },
} satisfies Record<Locale, Record<string, string>>;

export function LegalDocumentPage({
  pageLabel,
  title,
  subtitle,
  documentByLocale,
  highlights,
  headerAction,
  supportLabel,
  supportValue,
  backLabel,
}: LegalDocumentPageProps) {
  const { locale } = useLanguage();
  const activeLocale = locale === 'en' ? 'en' : 'pt';
  const document = documentByLocale[activeLocale];
  const copy = ui[activeLocale];
  const contactEmail = SILENTRA_CONTACT_EMAIL;

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50 antialiased">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.09),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_20%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)',
          backgroundSize: '72px 72px',
          maskImage: 'linear-gradient(to_bottom,black,transparent 88%)',
        }}
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <ArrowLeft className="size-4" />
            {backLabel[activeLocale]}
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-zinc-300 backdrop-blur-xl">
            <Sparkles className="size-3.5 text-emerald-300" />
            {pageLabel[activeLocale]}
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="grid gap-0 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="relative p-6 sm:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.34em] text-emerald-200">
                <ShieldCheck className="size-3.5" />
                {copy.introBadge}
              </div>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.06em] text-zinc-50 sm:text-5xl lg:text-7xl lg:leading-[0.94]">
                {title[activeLocale]}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
                {subtitle[activeLocale]}
              </p>
              {headerAction ? <div className="mt-6">{headerAction}</div> : null}
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-zinc-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
                  {copy.updated}: {document.lastUpdated}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
                  Silentra for Barbers
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
                  {contactEmail}
                </span>
              </div>
            </div>

            <aside className="border-t border-white/10 bg-black/30 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div className="space-y-4">
                {highlights.map((highlight) => (
                  <div
                    key={highlight.label.pt}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
                  >
                    <div className="flex items-start gap-3">
                      {highlight.icon && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-emerald-200 [&>svg]:size-4">
                          {highlight.icon}
                        </div>
                      )}
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                          {highlight.label[activeLocale]}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-6 text-zinc-100">
                          {highlight.value[activeLocale]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-50/90">
                <div className="flex items-center gap-2 text-emerald-200">
                  <Mail className="size-4" />
                  {supportLabel[activeLocale]}
                </div>
                <p className="mt-3 text-zinc-200">{contactEmail}</p>
                <p className="mt-3 text-zinc-400">{copy.supportHint}</p>
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <article className="rounded-3xl border border-white/10 bg-zinc-900/55 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-zinc-500">
                  {copy.contents}
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                  {normalizeContactText(document.intro)}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                <BadgeCheck className="size-3.5 text-emerald-300" />
                {document.sections.length}{' '}
                {activeLocale === 'pt' ? 'secções' : 'sections'}
              </div>
            </div>
            <div className="mt-8 space-y-5">
              {document.sections.map((section, index) => (
                <section
                  key={section.title}
                  id={`section-${index + 1}`}
                  className="rounded-2xl border border-white/10 bg-black/25 p-5 scroll-mt-24"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-zinc-200">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 className="text-lg font-semibold tracking-[-0.03em] text-zinc-50 sm:text-xl">
                      {section.title}
                    </h2>
                  </div>
                  <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-400 sm:text-[15px]">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{normalizeContactText(paragraph)}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl border border-white/10 bg-zinc-900/55 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <FileText className="size-4 text-emerald-300" />
                {copy.quickFacts}
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                {highlights.map((highlight) => (
                  <div
                    key={highlight.value.pt}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-zinc-500 [&>svg]:size-3.5 [&>svg]:text-zinc-300">
                      {highlight.icon}
                      {highlight.label[activeLocale]}
                    </dt>
                    <dd className="mt-2 text-sm leading-6 text-zinc-100">
                      {highlight.value[activeLocale]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-3xl border border-white/10 bg-zinc-900/55 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                <Mail className="size-4 text-emerald-300" />
                {copy.contact}
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                {supportLabel[activeLocale]}
              </p>
              <a
                href={`mailto:${contactEmail}`}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {contactEmail}
              </a>
            </div>
            <div className="rounded-3xl border border-white/10 bg-linear-to-br from-emerald-500/10 via-white/5 to-transparent p-5 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-200">
                Silentra
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {copy.supportHint}
              </p>
            </div>
          </aside>
        </div>

        <nav
          aria-label={
            activeLocale === 'pt' ? 'Documentos legais' : 'Legal documents'
          }
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-6 text-sm text-zinc-400"
        >
          <Link
            href="/terms"
            className="underline decoration-white/20 underline-offset-4 hover:text-white"
          >
            {activeLocale === 'pt'
              ? 'Termos e Condições'
              : 'Terms and Conditions'}
          </Link>
          <Link
            href="/privacy"
            className="underline decoration-white/20 underline-offset-4 hover:text-white"
          >
            {activeLocale === 'pt'
              ? 'Política de Privacidade'
              : 'Privacy Policy'}
          </Link>
          <Link
            href="/cookies"
            className="underline decoration-white/20 underline-offset-4 hover:text-white"
          >
            {activeLocale === 'pt' ? 'Política de Cookies' : 'Cookie Policy'}
          </Link>
        </nav>
      </div>
    </div>
  );
}
