'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Megaphone,
  Settings,
  Heart,
  CreditCard,
  LayoutDashboard,
  Home,
  Plus,
  Bell,
  UserRound,
  CalendarDays,
  Clock3,
  Users,
  Scissors,
  Briefcase,
  MessageCircle,
  Headset,
  QrCode,
  Globe2,
  MoreHorizontal,
  Sparkles,
  ScanLine,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FeaturePlanBadge } from '@/components/billing/FeaturePlanBadge';
import { lockBodyScroll } from '@/lib/ui/body-scroll-lock';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { FeatureKey } from '@/lib/billing/plan-features';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_BARBERSHOP_AVATAR } from '@/lib/barbershops/default-media';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
}

const primaryItems: SidebarItem[] = [
  { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
  { href: '/dashboard/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/servicos', label: 'Serviços', icon: Scissors },
];

const teamItems: SidebarItem[] = [
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
    href: '/dashboard/automations',
    label: 'Automações',
    icon: Zap,
    feature: 'marketing_campaigns',
  },
];

const toolsItems: SidebarItem[] = [
  { href: '/dashboard/qr-code', label: 'QR Code', icon: QrCode },
  {
    href: '/dashboard/espera',
    label: 'Lista de espera',
    icon: Clock3,
    feature: 'appointments',
  },
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
  {
    href: '/dashboard/loyalty/points',
    label: 'Regras de pontos',
    icon: Sparkles,
    feature: 'loyalty',
  },
  {
    href: '/dashboard/loyalty/validate',
    label: 'Validar recompensa',
    icon: ScanLine,
    feature: 'loyalty',
  },
  { href: '/dashboard/pos', label: 'Vendas', icon: CreditCard, feature: 'pos' },
  { href: '/dashboard/website', label: 'Site próprio', icon: Globe2 },
];

const secondaryItems: SidebarItem[] = [
  { href: '/dashboard/suporte', label: 'Suporte Silentra', icon: Headset },
  { href: '/dashboard/billing', label: 'Plano e pagamentos', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Definições', icon: Settings },
];

const englishLabels: Record<string, string> = {
  Início: 'Overview',
  Agenda: 'Appointments',
  Clientes: 'Clients',
  Serviços: 'Services',
  Equipa: 'Team',
  Comunicação: 'Communication',
  Mensagens: 'Messages',
  Campanhas: 'Campaigns',
  Automações: 'Automations',
  'QR Code': 'QR code',
  'Lista de espera': 'Waitlist',
  Relatórios: 'Reports',
  Fidelização: 'Loyalty',
  'Regras de pontos': 'Points rules',
  'Validar recompensa': 'Validate reward',
  Vendas: 'Sales',
  'Site próprio': 'Website',
  'Suporte Silentra': 'Silentra Support',
  'Plano e pagamentos': 'Plan and billing',
  Definições: 'Settings',
};

function localizeNavLabel(label: string, locale: string) {
  return locale === 'en' ? (englishLabels[label] ?? label) : label;
}

function BrandAvatar({ avatarUrl }: { avatarUrl: string | null }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const displayedAvatarUrl =
    avatarUrl && failedImageUrl !== avatarUrl
      ? avatarUrl
      : DEFAULT_BARBERSHOP_AVATAR;

  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100">
      <Image
        src={displayedAvatarUrl}
        alt=""
        fill
        sizes="32px"
        className="object-cover"
        unoptimized
        onError={() =>
          setFailedImageUrl(avatarUrl || DEFAULT_BARBERSHOP_AVATAR)
        }
      />
    </span>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasFeature } = useFeatureAccess();
  const { barbershopAvatarUrl } = useBarbershop();
  const { locale } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreDialogRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !prefersReducedMotion;

  const isLocked = (item: SidebarItem) =>
    Boolean(item.feature && !hasFeature(item.feature));

  const handleLocked = (item: SidebarItem) => {
    const label = localizeNavLabel(item.label, locale);
    toast.info(
      locale === 'en'
        ? `${label}: available on a higher plan.`
        : `${label}: disponível num plano superior.`,
      {
        description:
          locale === 'en'
            ? 'Your account will keep working normally. Upgrade your plan whenever you need this feature.'
            : 'A tua conta continua a funcionar normalmente. Podes mudar de plano quando precisares desta funcionalidade.',
        action: {
          label: locale === 'en' ? 'View plans' : 'Ver planos',
          onClick: () => router.push('/dashboard/billing'),
        },
      },
    );
  };

  const closeMore = () => setMoreOpen(false);

  useEffect(() => {
    if (!moreOpen) return;
    const dialog = moreDialogRef.current;
    if (!dialog) return;

    const releaseScrollLock = lockBodyScroll();
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.getAttribute('aria-hidden') !== 'true',
      );

    getFocusable()[0]?.focus();

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMoreOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = getFocusable();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeys);
    return () => {
      releaseScrollLock();
      document.removeEventListener('keydown', handleDialogKeys);
      moreTriggerRef.current?.focus();
    };
  }, [moreOpen]);

  const isActive = (item: SidebarItem) =>
    pathname === item.href ||
    (item.href !== '/dashboard' &&
      item.href !== '/dashboard/loyalty' &&
      pathname.startsWith(`${item.href}/`));
  const moreItems = [
    ...teamItems,
    ...communicationItems,
    ...toolsItems,
    ...secondaryItems,
  ];
  const moreActive = moreItems.some(isActive);

  const renderItem = (item: SidebarItem) => {
    const locked = isLocked(item);
    const active = isActive(item);
    const Icon = item.icon;
    const label = localizeNavLabel(item.label, locale);
    const className = cn(
      'flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
      active
        ? 'border-white/10 bg-white/[0.09] text-white'
        : 'border-transparent bg-white/[0.025] text-zinc-300 hover:border-white/8 hover:bg-white/[0.06] hover:text-white',
      locked && 'text-zinc-500 hover:text-zinc-300',
    );

    if (locked) {
      return (
        <button
          key={item.href}
          type="button"
          onClick={() => handleLocked(item)}
          className={className}
          aria-label={
            locale === 'en'
              ? `${label}, available on a higher plan`
              : `${label}, disponível num plano superior`
          }
        >
          <Icon className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <FeaturePlanBadge
            feature={item.feature!}
            className="ml-auto"
          />
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMore}
        className={className}
        aria-current={active ? 'page' : undefined}
      >
        <Icon
          className={cn(
            'size-4 shrink-0',
            active ? 'text-emerald-400' : 'text-zinc-500',
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {item.feature ? <FeaturePlanBadge feature={item.feature} /> : null}
        {active ? (
          <span
            className="size-1.5 shrink-0 rounded-full bg-emerald-400"
            aria-hidden="true"
          />
        ) : null}
      </Link>
    );
  };

  const sectionTitle = (pt: string, en: string) => (
    <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
      {locale === 'en' ? en : pt}
    </h2>
  );

  return (
    <>
      <TooltipProvider delayDuration={120}>
        <nav
          aria-label={locale === 'en' ? 'Dashboard navigation' : 'Navegação da dashboard'}
          className="fixed inset-x-0 bottom-[calc(0.8rem+env(safe-area-inset-bottom))] z-50 mx-auto w-[min(56rem,calc(100vw-1.25rem))] px-0.5 sm:bottom-5 sm:w-[min(58rem,calc(100vw-2rem))]"
        >
          <div className="relative rounded-[2.6rem] border border-white/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.13),rgba(255,255,255,0.035)_42%,rgba(0,0,0,0.2))] px-2.5 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(255,255,255,0.08)] backdrop-blur-[28px] sm:px-5">
            <div className="grid h-[4.1rem] grid-cols-6 items-center sm:h-[4.5rem]">
              {([
                { href: '/dashboard', label: locale === 'en' ? 'Home' : 'Início', icon: Home },
                { href: '/dashboard/loyalty', label: locale === 'en' ? 'Loyalty' : 'Fidelização', icon: Heart },
                { href: '/dashboard/agenda', label: locale === 'en' ? 'New appointment' : 'Nova marcação', icon: Plus, prominent: true },
                { href: '/dashboard/clientes', label: locale === 'en' ? 'Clients' : 'Clientes', icon: UserRound },
                { href: '/dashboard/comunicacao', label: locale === 'en' ? 'Notifications' : 'Notificações', icon: Bell },
              ]).map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        aria-current={active ? 'page' : undefined}
                        className="relative mx-auto flex size-12 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:size-[3.6rem]"
                      >
                        {active ? (
                          <motion.span
                            layoutId="silentra-dock-active"
                            className="absolute inset-0 rounded-full border border-emerald-100/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.34),rgba(6,78,59,0.56))] shadow-[0_0_22px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.24)]"
                            transition={motionEnabled ? { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 } : { duration: 0 }}
                          />
                        ) : null}
                        {item.prominent ? (
                          <span className="absolute inset-0 rounded-full bg-white/[0.045] transition-colors hover:bg-white/[0.11]" />
                        ) : null}
                        <Icon className={cn('relative z-10 size-[1.65rem] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-105', active && 'text-white')} aria-hidden="true" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={14} className="border border-white/15 bg-zinc-900/90 text-zinc-100 shadow-xl backdrop-blur-xl">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    ref={moreTriggerRef}
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-label={locale === 'en' ? 'More dashboard sections' : 'Mais secções da dashboard'}
                    aria-expanded={moreOpen}
                    aria-controls="dashboard-more-panel"
                    className={cn(
                      'relative mx-auto flex size-12 items-center justify-center rounded-full text-white outline-none transition-colors duration-200 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-300 sm:size-[3.6rem]',
                      moreOpen || moreActive ? 'bg-white/10' : '',
                    )}
                  >
                    {moreOpen || moreActive ? (
                      <motion.span
                        layoutId="silentra-dock-active"
                        className="absolute inset-0 rounded-full border border-emerald-100/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.24),rgba(6,78,59,0.42))]"
                        transition={motionEnabled ? { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 } : { duration: 0 }}
                      />
                    ) : null}
                    <MoreHorizontal className="relative z-10 size-[1.7rem]" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={14} className="border border-white/15 bg-zinc-900/90 text-zinc-100 shadow-xl backdrop-blur-xl">
                  {locale === 'en' ? 'More' : 'Mais'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </nav>
      </TooltipProvider>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionEnabled ? 0.16 : 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
              onClick={closeMore}
              aria-label={
                locale === 'en' ? 'Close more menu' : 'Fechar menu Mais'
              }
            />
            <motion.aside
              id="dashboard-more-panel"
              ref={moreDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dashboard-more-title"
              initial={
                motionEnabled
                  ? { opacity: 0, y: 40, scale: 0.94, rotateX: -5, filter: 'blur(8px)' }
                  : false
              }
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0, filter: 'blur(0px)' }}
              exit={
                motionEnabled
                  ? { opacity: 0, y: 18, scale: 0.97, filter: 'blur(3px)' }
                  : undefined
              }
              transition={
                motionEnabled
                  ? { type: 'spring', stiffness: 360, damping: 30, mass: 0.8 }
                  : { duration: 0 }
              }
              className="absolute inset-x-2 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] mx-auto flex max-h-[min(72vh,42rem)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/98 shadow-2xl shadow-black/50 sm:inset-x-4 lg:bottom-[5.75rem]"
              style={{ transformOrigin: 'bottom center', perspective: 1200 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandAvatar avatarUrl={barbershopAvatarUrl} />
                  <div className="min-w-0">
                    <h2
                      id="dashboard-more-title"
                      className="text-sm font-semibold text-white"
                    >
                      {locale === 'en' ? 'More sections' : 'Mais secções'}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      {locale === 'en'
                        ? 'Everything else, organised by task'
                        : 'O resto da plataforma, organizado por área'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMore}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label={locale === 'en' ? 'Close menu' : 'Fechar menu'}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <section>
                    {sectionTitle('Equipa', 'Team')}
                    <div className="grid gap-1.5">
                      {teamItems.map(renderItem)}
                    </div>
                    <div className="mt-5">
                      {sectionTitle('Comunicação', 'Communication')}
                      <div className="grid gap-1.5">
                        {communicationItems.map(renderItem)}
                      </div>
                    </div>
                  </section>
                  <section>
                    {sectionTitle(
                      'Ferramentas e crescimento',
                      'Tools & growth',
                    )}
                    <div className="grid gap-1.5">
                      {toolsItems.map(renderItem)}
                    </div>
                  </section>
                  <section>
                    {sectionTitle('Conta e ajuda', 'Account & support')}
                    <div className="grid gap-1.5">
                      {secondaryItems.map(renderItem)}
                    </div>
                    <Link
                      href="/documentation"
                      onClick={closeMore}
                      className="mt-1 flex min-h-11 items-center gap-2.5 rounded-xl border border-transparent px-3 text-sm font-medium text-zinc-400 transition-colors hover:border-white/8 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Globe2
                        className="size-4 text-zinc-500"
                        aria-hidden="true"
                      />
                      {locale === 'en' ? 'Documentation' : 'Documentação'}
                    </Link>
                  </section>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/8 px-4 py-2.5 text-xs text-zinc-500 sm:px-5">
                <span>
                  {locale === 'en' ? 'Quick access' : 'Acesso rápido'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full bg-emerald-400"
                    aria-hidden="true"
                  />
                  Silentra
                </span>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
