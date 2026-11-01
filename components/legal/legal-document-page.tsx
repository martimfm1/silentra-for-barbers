'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Mail,
  Printer,
  Search,
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

const legalLinks = [
  { href: '/legal', pt: 'Centro legal', en: 'Legal centre' },
  { href: '/acceptable-use', pt: 'Utilização aceitável', en: 'Acceptable use' },
  { href: '/terms', pt: 'Termos e Condições', en: 'Terms and Conditions' },
  { href: '/privacy', pt: 'Privacidade', en: 'Privacy' },
  { href: '/cookies', pt: 'Cookies', en: 'Cookies' },
  { href: '/booking-terms', pt: 'Reservas', en: 'Bookings' },
  { href: '/billing-policy', pt: 'Faturação', en: 'Billing' },
  { href: '/dpa', pt: 'Adenda de tratamento (DPA)', en: 'Data Processing Addendum' },
  { href: '/subprocessors', pt: 'Subprocessadores', en: 'Subprocessors' },
] as const;

const ui = {
  pt: {
    updated: 'Última atualização',
    summary: 'Em resumo',
    contents: 'Nesta página',
    contact: 'Contacto',
    introBadge: 'Documentação legal',
    print: 'Imprimir / guardar PDF',
    search: 'Pesquisar nesta política',
    searchPlaceholder: 'Ex.: pagamentos, dados, cancelamento…',
    sections: 'secções',
    noResults: 'Não foram encontradas secções com esse termo.',
    entity: 'Entidade responsável pela plataforma',
    entityName: 'Denominação legal',
    entityAddress: 'Morada',
    entityTaxId: 'NIF',
    entityMissing: 'Os dados de identificação jurídica da entidade exploradora ainda não estão configurados nesta página. Solicita-os através do contacto indicado antes de celebrar um contrato.',
    supportHint: 'Para pedidos, esclarecimentos ou exercício de direitos, utiliza o contacto indicado. Não envies palavras-passe, códigos de autenticação ou dados de cartão por email.',
    allDocuments: 'Todos os documentos',
    goHome: 'Voltar ao site',
  },
  en: {
    updated: 'Last updated',
    summary: 'At a glance',
    contents: 'On this page',
    contact: 'Contact',
    introBadge: 'Legal documentation',
    print: 'Print / save PDF',
    search: 'Search this policy',
    searchPlaceholder: 'E.g. payments, data, cancellation…',
    sections: 'sections',
    noResults: 'No sections match that search.',
    entity: 'Platform operator',
    entityName: 'Legal name',
    entityAddress: 'Address',
    entityTaxId: 'Tax number',
    entityMissing: 'The operator’s legal identification details are not configured on this page yet. Request them using the contact below before entering into a contract.',
    supportHint: 'For requests, questions, or to exercise your rights, use the contact below. Do not email passwords, authentication codes, or card details.',
    allDocuments: 'All documents',
    goHome: 'Back to website',
  },
} satisfies Record<Locale, Record<string, string>>;

function sectionId(index: number) {
  return `legal-section-${index + 1}`;
}

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
  const activeLocale: Locale = locale === 'en' ? 'en' : 'pt';
  const document = documentByLocale[activeLocale];
  const copy = ui[activeLocale];
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase(activeLocale);
  const visibleSections = useMemo(
    () =>
      document.sections
        .map((section, index) => ({ section, index }))
        .filter(({ section }) => {
          if (!query) return true;
          return `${section.title} ${section.paragraphs.join(' ')}`
            .toLocaleLowerCase(activeLocale)
            .includes(query);
        }),
    [activeLocale, document.sections, query],
  );

  const entityName = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() ?? '';
  const entityAddress =
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS?.trim() ?? '';
  const entityTaxId = process.env.NEXT_PUBLIC_LEGAL_ENTITY_TAX_ID?.trim() ?? '';
  const hasLegalIdentity = Boolean(entityName && entityAddress && entityTaxId);

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.13),transparent_65%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/legal"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel[activeLocale]}
          </Link>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-3 text-xs font-medium text-violet-200">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {pageLabel[activeLocale]}
          </span>
        </div>

        <header className="rounded-3xl border border-white/10 bg-zinc-900/75 p-5 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
                {copy.introBadge}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {title[activeLocale]}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                {subtitle[activeLocale]}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-300">
                <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  {copy.updated}: {document.lastUpdated}
                </span>
                <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  Silentra for Barbers
                </span>
              </div>
              {headerAction ? <div className="mt-5">{headerAction}</div> : null}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 print:hidden"
            >
              <Printer className="size-4" aria-hidden="true" />
              {copy.print}
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={copy.summary}>
          {highlights.map((highlight) => (
            <div
              key={highlight.label.pt}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                {highlight.icon ? (
                  <span className="text-violet-300 [&>svg]:size-4">
                    {highlight.icon}
                  </span>
                ) : null}
                {highlight.label[activeLocale]}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-200">
                {highlight.value[activeLocale]}
              </p>
            </div>
          ))}
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <article className="min-w-0 rounded-3xl border border-white/10 bg-zinc-900/60 p-5 sm:p-7">
            <div className="border-b border-white/10 pb-5">
              <p className="text-sm leading-7 text-zinc-300">
                {document.intro}
              </p>
              <label className="mt-5 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 focus-within:border-violet-400/60 focus-within:ring-2 focus-within:ring-violet-400/20">
                <Search className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
                <span className="sr-only">{copy.search}</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    {activeLocale === 'pt' ? 'Limpar' : 'Clear'}
                  </button>
                ) : null}
              </label>
              <p className="mt-2 text-xs text-zinc-500">
                {visibleSections.length} {copy.sections}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {visibleSections.length ? (
                visibleSections.map(({ section, index }) => (
                  <section
                    key={section.title}
                    id={sectionId(index)}
                    className="scroll-mt-24 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"
                  >
                    <h2 className="text-base font-semibold leading-6 text-white sm:text-lg">
                      {section.title}
                    </h2>
                    <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-300">
                      {section.paragraphs.map((paragraph, paragraphIndex) => (
                        <p key={paragraphIndex}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-zinc-400">
                  {copy.noResults}
                </p>
              )}
            </div>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-5 print:hidden">
            <nav
              aria-label={copy.contents}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileText className="size-4 text-violet-300" aria-hidden="true" />
                {copy.contents}
              </h2>
              <details className="mt-3 lg:hidden">
                <summary className="cursor-pointer rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                  {activeLocale === 'pt' ? 'Ver índice' : 'Show contents'}
                </summary>
                <ol className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                  {document.sections.map((section, index) => (
                    <li key={section.title}>
                      <a
                        href={`#${sectionId(index)}`}
                        className="block rounded-lg px-2 py-2 text-xs leading-5 text-zinc-400 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
              <ol className="mt-3 hidden max-h-[65vh] space-y-1 overflow-y-auto lg:block">
                {document.sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#${sectionId(index)}`}
                      className="block rounded-lg px-2 py-2 text-xs leading-5 text-zinc-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <h2 className="text-sm font-semibold text-white">{copy.contact}</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                {supportLabel[activeLocale]}
              </p>
              <a
                href={`mailto:${supportValue}`}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-zinc-100 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <Mail className="size-4" aria-hidden="true" />
                {supportValue}
              </a>
              <p className="mt-3 text-xs leading-5 text-zinc-500">{copy.supportHint}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <h2 className="text-sm font-semibold text-white">{copy.entity}</h2>
              {hasLegalIdentity ? (
                <dl className="mt-3 space-y-3 text-xs">
                  <div>
                    <dt className="text-zinc-500">{copy.entityName}</dt>
                    <dd className="mt-1 text-zinc-200">{entityName}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{copy.entityAddress}</dt>
                    <dd className="mt-1 text-zinc-200">{entityAddress}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{copy.entityTaxId}</dt>
                    <dd className="mt-1 text-zinc-200">{entityTaxId}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-xs leading-5 text-amber-200/90">{copy.entityMissing}</p>
              )}
            </div>
          </aside>
        </div>

        <nav
          aria-label={activeLocale === 'pt' ? 'Documentos legais' : 'Legal documents'}
          className="flex flex-wrap gap-2 border-t border-white/10 pt-5 text-xs text-zinc-400 print:hidden"
        >
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-white/10 px-3 py-2 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              {link[activeLocale]}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
