'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { PwaInstallButton } from '@/components/pwa-install-button';

const routeLabels: Record<string, { pt: string; en: string }> = {
  dashboard: { pt: 'Visão geral', en: 'Overview' },
  agenda: { pt: 'Agenda', en: 'Appointments' },
  analytics: { pt: 'Relatórios', en: 'Reports' },
  automations: { pt: 'Automações', en: 'Automations' },
  billing: { pt: 'Plano e pagamentos', en: 'Plan and billing' },
  clientes: { pt: 'Clientes', en: 'Clients' },
  comunicacao: { pt: 'Comunicação', en: 'Communication' },
  crm: { pt: 'CRM', en: 'CRM' },
  equipa: { pt: 'Equipa', en: 'Team' },
  loyalty: { pt: 'Fidelização', en: 'Loyalty' },
  marketing: { pt: 'Marketing', en: 'Marketing' },
  mensagens: { pt: 'Mensagens', en: 'Messages' },
  pos: { pt: 'Vendas', en: 'Sales' },
  'qr-code': { pt: 'QR Code', en: 'QR code' },
  settings: { pt: 'Definições', en: 'Settings' },
  servicos: { pt: 'Serviços', en: 'Services' },
  suporte: { pt: 'Suporte Silentra', en: 'Silentra Support' },
  website: { pt: 'Site próprio', en: 'Website' },
  checkout: { pt: 'Checkout', en: 'Checkout' },
  'public-profile': { pt: 'Perfil público', en: 'Public profile' },
  booking: { pt: 'Marcações', en: 'Bookings' },
};

export function DashboardTopBar() {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
  const segments = pathname.split('/').filter(Boolean).slice(1);
  const currentSegment = segments.at(-1) ?? 'dashboard';
  const parentSegment = segments.at(-2);
  const labelKey = routeLabels[currentSegment]
    ? currentSegment
    : parentSegment && routeLabels[parentSegment]
      ? parentSegment
      : 'dashboard';
  const currentLabel = routeLabels[labelKey][locale === 'en' ? 'en' : 'pt'];

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/5 bg-zinc-950/65 backdrop-blur-xl lg:left-64">
      <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <nav
          aria-label={locale === 'en' ? 'Page navigation' : 'Navegação da página'}
          className="flex min-w-0 items-center gap-2"
        >
          {pathname !== '/dashboard' ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label={t('dashboard.backToOverview')}
              >
                <Home className="size-4" aria-hidden="true" />
              </Link>
              <ChevronRight className="size-4 shrink-0 text-zinc-600" aria-hidden="true" />
            </>
          ) : null}
          <span
            className="min-w-0 truncate text-sm font-semibold text-zinc-100 sm:text-base"
            aria-current="page"
          >
            {currentLabel}
          </span>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <PwaInstallButton locale={locale === 'en' ? 'en' : 'pt'} />
          <Link
            href="/"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:px-3.5"
            aria-label={t('dashboard.backToSite')}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('dashboard.backToSite')}</span>
            <span className="sm:hidden">Site</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
