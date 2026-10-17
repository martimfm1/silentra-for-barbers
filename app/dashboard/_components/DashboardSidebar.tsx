'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  Megaphone,
  Settings,
  Heart,
  CreditCard,
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Briefcase,
  MessageCircle,
  Headset,
  Menu,
  X,
  Lock,
  QrCode,
  Globe2,
  ChevronDown,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { FeatureKey } from '@/lib/billing/plan-features';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_BARBERSHOP_AVATAR } from '@/lib/barbershops/default-media';

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
}

type BrandAvatarProps = { mobile?: boolean; avatarUrl: string | null };

function BrandAvatar({ mobile = false, avatarUrl }: BrandAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const displayedAvatarUrl =
    avatarUrl && failedImageUrl !== avatarUrl
      ? avatarUrl
      : DEFAULT_BARBERSHOP_AVATAR;

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100',
        mobile ? 'size-8' : 'size-9',
      )}
    >
      <Image
        src={displayedAvatarUrl}
        alt="Avatar da barbearia"
        fill
        sizes={mobile ? '32px' : '36px'}
        className="object-cover"
        unoptimized
        onError={() =>
          setFailedImageUrl(avatarUrl || DEFAULT_BARBERSHOP_AVATAR)
        }
      />
    </span>
  );
}

const primaryItems: SidebarItem[] = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/dashboard/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/servicos', label: 'Serviços', icon: Scissors },
  {
    href: '/dashboard/equipa',
    label: 'Equipa',
    icon: Briefcase,
    feature: 'team_management',
  },
];

const communicationItems: SidebarItem[] = [
  { href: '/dashboard/comunicacao', label: 'Comunicação', icon: Megaphone },
  {
    href: '/dashboard/mensagens',
    label: 'Mensagens',
    icon: MessageCircle,
    feature: 'messaging',
  },
  {
    href: '/dashboard/marketing',
    label: 'Campanhas',
    icon: Megaphone,
    feature: 'marketing_campaigns',
  },
  {
    href: '/dashboard/mensagens/birthdays',
    label: 'Aniversários',
    icon: MessageCircle,
    feature: 'messaging',
  },
];

const toolsItems: SidebarItem[] = [
  { href: '/dashboard/qr-code', label: 'QR Code', icon: QrCode },
  {
    href: '/dashboard/analytics',
    label: 'Relatórios',
    icon: BarChart3,
    feature: 'advanced_analytics',
  },
  {
    href: '/dashboard/loyalty',
    label: 'Fidelização',
    icon: Heart,
    feature: 'loyalty',
  },
  { href: '/dashboard/pos', label: 'Vendas', icon: CreditCard, feature: 'pos' },
  // Keep the entry available on every plan; the page explains purchase and access.
  { href: '/dashboard/website', label: 'Site próprio', icon: Globe2 },
];

const secondaryItems: SidebarItem[] = [
  { href: '/dashboard/suporte', label: 'Suporte Silentra', icon: Headset },
  { href: '/dashboard/billing', label: 'Plano e pagamentos', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Definições', icon: Settings },
];

const englishLabels: Record<string, string> = {
  'Início': 'Overview',
  'Agenda': 'Appointments',
  'Clientes': 'Clients',
  'Serviços': 'Services',
  'Equipa': 'Team',
  'Comunicação': 'Communication',
  'Mensagens': 'Messages',
  'Campanhas': 'Campaigns',
  'Aniversários': 'Birthdays',
  'QR Code': 'QR code',
  'Relatórios': 'Reports',
  'Fidelização': 'Loyalty',
  'Vendas': 'Sales',
  'Site próprio': 'Website',
  'Suporte Silentra': 'Silentra Support',
  'Plano e pagamentos': 'Plan and billing',
  'Definições': 'Settings',
};

function localizeNavLabel(label: string, locale: string) {
  return locale === 'en' ? (englishLabels[label] ?? label) : label;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasFeature } = useFeatureAccess();
  const { barbershopAvatarUrl } = useBarbershop();
  const { t, locale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(() =>
    ['/dashboard/qr-code', '/dashboard/analytics', '/dashboard/loyalty', '/dashboard/pos', '/dashboard/website'].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ),
  );
  const [communicationOpen, setCommunicationOpen] = useState(
    () =>
      pathname.startsWith('/dashboard/comunicacao') ||
      pathname.startsWith('/dashboard/mensagens') ||
      pathname.startsWith('/dashboard/marketing'),
  );

  const mobilePrimary = primaryItems.slice(0, 4);
  const isLocked = (item: SidebarItem) =>
    Boolean(item.feature && !hasFeature(item.feature));

  const handleLocked = (item: SidebarItem) => {
    toast.info(`${item.label}: disponível num plano superior.`, {
      description:
        'A tua conta continua a funcionar normalmente. Podes mudar de plano quando precisares desta funcionalidade.',
      action: {
        label: 'Ver planos',
        onClick: () => router.push('/dashboard/billing'),
      },
    });
  };

  const closeMobile = () => setMobileOpen(false);

  const renderItem = (item: SidebarItem, mobile = false) => {
    const locked = isLocked(item);
    const active =
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
    const Icon = item.icon;
    const itemLabel = localizeNavLabel(item.label, locale);

    if (locked) {
      return (
        <button
          key={item.href}
          type="button"
          onClick={() => handleLocked(item)}
          className={cn(
            'group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-[background-color,color,transform] duration-200 motion-reduce:transition-none text-zinc-500 hover:bg-white/5 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            mobile && 'min-h-12',
          )}
          aria-label={locale === 'en' ? `${itemLabel}, available on a higher plan` : `${itemLabel}, disponível num plano superior`}
        >
          <Icon className="size-4 shrink-0 text-zinc-600" aria-hidden="true" />
          <span className="truncate">{itemLabel}</span>
          <Lock
            className="ml-auto size-3.5 shrink-0 text-zinc-600"
            aria-hidden="true"
          />
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={mobile ? closeMobile : undefined}
        className={cn(
          'glassmorphism group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm transition-[background-color,color,transform] duration-200 motion-reduce:transition-none',
          active
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          mobile && 'min-h-12',
        )}
        aria-current={active ? 'page' : undefined}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-2 left-0 w-0.5 origin-center rounded-full bg-emerald-400 transition-transform duration-200 motion-reduce:transition-none',
            active ? 'scale-y-100' : 'scale-y-0',
          )}
        />
        <Icon
          className={cn(
            'size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
            active
              ? 'translate-x-0.5 text-emerald-400'
              : 'text-zinc-500 group-hover:translate-x-0.5 group-hover:text-zinc-300',
          )}
          aria-hidden="true"
        />
        <span className="truncate">{itemLabel}</span>
      </Link>
    );
  };

  const renderCommunication = (mobile = false) => {
    const active = communicationItems.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    return (
      <div key="communication" className="space-y-1">
        <button
          type="button"
          onClick={() => setCommunicationOpen((value) => !value)}
          className={cn(
            'group relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-sm transition-[background-color,color] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            active
              ? 'bg-white/[0.06] text-white'
              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
            mobile && 'min-h-12',
          )}
          aria-expanded={communicationOpen}
          aria-controls={mobile ? 'dashboard-communication-mobile' : 'dashboard-communication-desktop'}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-2 left-0 w-0.5 origin-center rounded-full bg-emerald-400 transition-transform duration-200 motion-reduce:transition-none',
              active ? 'scale-y-100' : 'scale-y-0',
            )}
          />
          <Megaphone
            className={cn(
              'size-4 shrink-0',
              active ? 'text-emerald-400' : 'text-zinc-500',
            )}
            aria-hidden="true"
          />
          <span className="truncate">Comunicação</span>
          <ChevronDown
            className={cn(
              'ml-auto size-4 transition-transform duration-200 motion-reduce:transition-none',
              communicationOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
        <div
          id={mobile ? 'dashboard-communication-mobile' : 'dashboard-communication-desktop'}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none',
            communicationOpen
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0 pointer-events-none',
          )}
          hidden={!communicationOpen}
        >
          <div className="min-h-0 ml-3 space-y-1 border-l border-white/10 pl-3">
            {communicationItems.map((item) => renderItem(item, mobile))}
          </div>
        </div>
      </div>
    );
  };

  const renderTools = (mobile = false) => {
    const active = toolsItems.some(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
    const panelId = mobile ? 'dashboard-tools-mobile' : 'dashboard-tools-desktop';

    return (
      <div key="tools" className="space-y-1">
        <button
          type="button"
          onClick={() => setToolsOpen((value) => !value)}
          className={cn(
            'group relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-sm transition-[background-color,color] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            active ? 'bg-white/[0.06] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
            mobile && 'min-h-12',
          )}
          aria-expanded={toolsOpen}
          aria-controls={panelId}
        >
          <Wrench className={cn('size-4 shrink-0', active ? 'text-emerald-400' : 'text-zinc-500')} aria-hidden="true" />
          <span className="truncate">{locale === 'en' ? 'Tools & insights' : 'Ferramentas e análise'}</span>
          <ChevronDown className={cn('ml-auto size-4 transition-transform duration-200 motion-reduce:transition-none', toolsOpen && 'rotate-180')} aria-hidden="true" />
        </button>
        <div
          id={panelId}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none',
            toolsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none',
          )}
          hidden={!toolsOpen}
        >
          <div className="min-h-0 ml-3 space-y-1 border-l border-white/10 pl-3">
            {toolsItems.map((item) => renderItem(item, mobile))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-zinc-950/10 backdrop-blur-xl lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-20 shrink-0 items-center border-b border-white/10 px-5">
            <Link
              href="/dashboard"
              className="group flex min-h-11 items-center gap-3 rounded-xl px-2 text-zinc-100 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={t('dashboard.backToOverview')}
            >
              <BrandAvatar avatarUrl={barbershopAvatarUrl} />
              <span className="font-heading text-lg font-semibold tracking-tight">
                Silentra
              </span>
            </Link>
          </div>
          <nav
            aria-label={locale === 'en' ? 'Main navigation' : 'Navegação principal'}
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-5"
          >
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              Menu
            </p>
            {primaryItems.map((item) => renderItem(item))}
            <div className="my-2 border-t border-white/[0.06]" />
            {renderCommunication()}
            {renderTools()}
            <div className="my-2 border-t border-white/[0.06]" />
            {secondaryItems.map((item) => renderItem(item))}
          </nav>
        </div>
      </aside>

      <nav
        aria-label={locale === 'en' ? 'Quick navigation' : 'Navegação rápida'}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {mobilePrimary.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex min-h-12 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-1 text-[10px] font-medium transition-[background-color,color] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-3 bottom-1 h-0.5 origin-center rounded-full bg-emerald-400 transition-transform duration-200 motion-reduce:transition-none',
                    active ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
                <Icon
                  className={cn(
                    'size-4 transition-transform duration-200 motion-reduce:transition-none',
                    active && '-translate-y-0.5 text-emerald-400',
                  )}
                  aria-hidden="true"
                />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label={t('dashboard.openMenu')}
            aria-expanded={mobileOpen}
          >
            <Menu className="size-4" aria-hidden="true" />
            <span>{locale === 'en' ? 'More' : 'Mais'}</span>
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={locale === 'en' ? 'Dashboard menu' : 'Menu do painel'}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={closeMobile}
            aria-label={locale === 'en' ? 'Close menu' : 'Fechar menu'}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(88vw,24rem)] flex-col border-l border-white/10 bg-zinc-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className="flex min-h-10 items-center gap-2 rounded-lg text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <BrandAvatar avatarUrl={barbershopAvatarUrl} mobile />
                <span className="font-heading font-semibold">Silentra</span>
              </Link>
              <button
                type="button"
                onClick={closeMobile}
                className="inline-flex size-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Fechar menu"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <nav
              aria-label={locale === 'en' ? 'All areas' : 'Todas as áreas'}
              className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-4"
            >
              {primaryItems.map((item) => renderItem(item, true))}
              <div className="my-2 border-t border-white/[0.06]" />
              {renderCommunication(true)}
              {renderTools(true)}
              <div className="my-2 border-t border-white/[0.06]" />
              {secondaryItems.map((item) => renderItem(item, true))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
