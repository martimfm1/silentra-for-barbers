'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { MenuIcon } from '@/components/MenuIcon';
import { BarberIcon } from './BarberIcon';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { NAVBAR_POPUP_TRANSITION, NAVBAR_TRANSITION } from './navbar-motion';

type NavigationRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'barber'
  | 'receptionist'
  | 'staff'
  | 'client';
type NavPermission =
  | 'dashboard'
  | 'agenda'
  | 'clients'
  | 'services'
  | 'team'
  | 'messages'
  | 'marketing'
  | 'loyalty'
  | 'automations'
  | 'analytics'
  | 'qr'
  | 'settings'
  | 'billing';
type NavLink = { label: string; href: string; permission?: NavPermission };

const NAV_PERMISSIONS: NavPermission[] = [
  'dashboard',
  'agenda',
  'clients',
  'services',
  'team',
  'messages',
  'marketing',
  'loyalty',
  'automations',
  'analytics',
  'qr',
  'settings',
  'billing',
];
const NAV_ROLES: NavigationRole[] = [
  'owner',
  'admin',
  'manager',
  'barber',
  'receptionist',
  'staff',
  'client',
];

export function SiteNavbar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [navigationRole, setNavigationRole] =
    useState<NavigationRole>('client');
  const [permissions, setPermissions] = useState<NavPermission[]>([]);
  const { t, locale } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const prefersReducedMotion = useReducedMotion();
  const isMotionEnabled = !prefersReducedMotion;
  const microSpring = isMotionEnabled
    ? { type: 'spring' as const, stiffness: 420, damping: 30, mass: 0.7 }
    : { duration: 0 };

  useEffect(() => {
    let mounted = true;
    async function syncSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    }
    void syncSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (!session?.user) {
          setNavigationRole('client');
          setPermissions([]);
        }
      },
    );
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function syncNavigationContext() {
      try {
        const response = await fetch('/api/navigation/context', {
          cache: 'no-store',
        });
        if (!response.ok)
          throw new Error(`navigation context ${response.status}`);
        const data = (await response.json()) as {
          role?: string;
          permissions?: string[];
        };
        if (cancelled) return;
        const role = NAV_ROLES.includes(data.role as NavigationRole)
          ? (data.role as NavigationRole)
          : 'client';
        setNavigationRole(role);
        setPermissions(
          (data.permissions ?? []).filter((value): value is NavPermission =>
            NAV_PERMISSIONS.includes(value as NavPermission),
          ),
        );
      } catch (error) {
        if (cancelled) return;
        console.warn('[NAVIGATION_CONTEXT_SYNC]', error);
        setNavigationRole('client');
        setPermissions([]);
      }
    }
    void syncNavigationContext();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      )
        setDropdownOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const getUserDetails = () => {
    const fullName =
      user?.user_metadata?.name || user?.user_metadata?.full_name;
    const fallback = user?.email?.split('@')[0] || 'User';
    const firstName = (fullName || fallback).split(' ')[0];
    return {
      firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
      initial: firstName.charAt(0).toUpperCase(),
    };
  };
  const { firstName, initial } = user
    ? getUserDetails()
    : { firstName: '', initial: '' };

  const permissionGranted = (permission: NavPermission) =>
    navigationRole === 'owner' || permissions.includes(permission);

  const teamLinks = useMemo<NavLink[]>(
    () => [
      {
        label: t('nav.dashboard', { defaultValue: 'Painel' }),
        href: '/dashboard',
        permission: 'dashboard',
      },
      {
        label: t('dashboard.appointments', { defaultValue: 'Agendamentos' }),
        href: '/dashboard/agenda',
        permission: 'agenda',
      },
      {
        label: t('dashboard.clients', { defaultValue: 'Clientes' }),
        href: '/dashboard/clients',
        permission: 'clients',
      },
      {
        label: t('dashboard.loyalty', { defaultValue: 'Fidelização' }),
        href: '/dashboard/loyalty',
        permission: 'loyalty',
      },
      {
        label: t('nav.stats', { defaultValue: 'Estatísticas' }),
        href: '/dashboard/analytics',
        permission: 'analytics',
      },
      {
        label: t('dashboard.team', { defaultValue: 'Equipa' }),
        href: '/dashboard/team',
        permission: 'team',
      },
      {
        label: t('dashboard.settings', { defaultValue: 'Definições' }),
        href: '/dashboard/settings',
        permission: 'settings',
      },
    ],
    [t],
  );

  const customerLinks = useMemo<NavLink[]>(
    () => [
      {
        label: t('nav.barbershops', { defaultValue: 'Barbearias' }),
        href: '/barbershops',
      },
      {
        label: t('nav.manageBookings', { defaultValue: 'As minhas marcações' }),
        href: '/my-bookings',
      },
      {
        label: t('nav.howItWorks', { defaultValue: 'Como funciona' }),
        href: '/#howitworks',
      },
    ],
    [t],
  );

  const guestLinks = useMemo<NavLink[]>(
    () => [
      {
        label: t('nav.barbershops', { defaultValue: 'Barbearias' }),
        href: '/barbershops',
      },
      {
        label: t('nav.plans', { defaultValue: 'Planos' }),
        href: '/plans',
      },
      {
        label: t('nav.howItWorks', { defaultValue: 'Como funciona' }),
        href: '/#howitworks',
      },
      {
        label: t('nav.forBarbers', { defaultValue: 'Para barbeiros' }),
        href: '/registo',
      },
    ],
    [t],
  );

  const links = !user
    ? guestLinks
    : navigationRole === 'client'
      ? customerLinks
      : teamLinks.filter(
          (link) => !link.permission || permissionGranted(link.permission),
        );

  const roleLabel =
    navigationRole === 'client'
      ? locale === 'pt'
        ? 'Cliente'
        : 'Customer'
      : navigationRole === 'owner'
        ? locale === 'pt'
          ? 'Proprietário'
          : 'Owner'
        : navigationRole === 'admin'
          ? 'Admin'
          : navigationRole === 'manager'
            ? locale === 'pt'
              ? 'Gestor'
              : 'Manager'
            : navigationRole === 'barber'
              ? locale === 'pt'
                ? 'Barbeiro'
                : 'Barber'
              : navigationRole === 'receptionist'
                ? locale === 'pt'
                  ? 'Receção'
                  : 'Receptionist'
                : 'Staff';

  const isActive = (href: string) =>
    href.startsWith('/#')
      ? pathname === '/'
      : href === '/'
        ? pathname === '/'
        : pathname === href || pathname.startsWith(`${href}/`);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setOpen(false);
    setNavigationRole('client');
    setPermissions([]);
    router.push('/');
  };

  return (
    <>
      <motion.header
        initial={isMotionEnabled ? { opacity: 0, y: -10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={
          isMotionEnabled
            ? { duration: 0.42, ease: 'easeOut' }
            : { duration: 0 }
        }
        className="fixed inset-x-0 top-0 z-[200] px-3 pt-3 sm:px-4 sm:pt-4"
      >
        <motion.div
          className={cn(
            'glassmorphism mx-auto flex h-[4.25rem] w-full max-w-7xl items-center rounded-2xl border px-2 shadow-2xl backdrop-blur-2xl',
            isScrolled
              ? 'border-white/15 bg-zinc-950/82 shadow-black/30'
              : 'border-white/10 bg-zinc-950/62 shadow-black/20',
          )}
          animate={{
            borderRadius: isScrolled ? 18 : 22,
            boxShadow: isScrolled
              ? '0 18px 60px rgba(0,0,0,0.30)'
              : '0 14px 50px rgba(0,0,0,0.22)',
          }}
          transition={NAVBAR_TRANSITION}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 px-1 sm:gap-3 sm:px-2">
            <Link
              href="/"
              aria-label="Silentra"
              onClick={() => setOpen(false)}
              className="group flex min-h-11 min-w-0 shrink-0 items-center gap-2.5 rounded-xl px-2 text-zinc-100 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 sm:gap-3 sm:px-3"
            >
              <motion.span
                className="flex size-8 shrink-0 items-center justify-center text-zinc-100 sm:size-9"
                whileHover={
                  isMotionEnabled ? { rotate: -3, scale: 1.04 } : undefined
                }
                whileTap={isMotionEnabled ? { scale: 0.96 } : undefined}
                transition={microSpring}
              >
                <BarberIcon className="size-7 sm:size-8" />
              </motion.span>
              <span className="font-heading text-[1.02rem] font-semibold tracking-tight sm:text-lg">
                Silentra
              </span>
            </Link>
            <nav
              aria-label={t('dashboard.mainNavigation', {
                defaultValue: 'Navegação principal',
              })}
              className="hidden min-w-0 items-center gap-1 lg:flex"
            >
              {links.map((link, index) => {
                const active = isActive(link.href);
                return (
                  <motion.div
                    key={link.href}
                    initial={isMotionEnabled ? { opacity: 0, y: -4 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      isMotionEnabled
                        ? { delay: index * 0.035, duration: 0.22 }
                        : { duration: 0 }
                    }
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex min-h-10 items-center rounded-xl px-3 text-[13px] font-medium transition-[background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25',
                        active
                          ? 'bg-white/[0.09] text-white'
                          : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100',
                      )}
                    >
                      <motion.span
                        whileHover={isMotionEnabled ? { y: -1 } : undefined}
                        transition={microSpring}
                      >
                        {link.label}
                      </motion.span>
                      {active ? (
                        <motion.span
                          layoutId="navbar-active-indicator"
                          aria-hidden="true"
                          className="absolute inset-x-3 -bottom-px h-px bg-white/70"
                          transition={microSpring}
                        />
                      ) : null}
                    </Link>
                  </motion.div>
                );
              })}
              <span className="ml-1 h-6 w-px bg-white/8" aria-hidden="true" />
              <LanguageSwitcher />
            </nav>
          </div>

          <div
            ref={dropdownRef}
            className="relative z-[210] flex shrink-0 items-center gap-1.5 sm:gap-2"
          >
            {!loading && user ? (
              <>
                <motion.button
                  type="button"
                  onClick={() => setDropdownOpen((current) => !current)}
                  aria-label={
                    locale === 'pt'
                      ? `Conta de ${firstName}`
                      : `Account of ${firstName}`
                  }
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  whileHover={isMotionEnabled ? { scale: 1.03 } : undefined}
                  whileTap={isMotionEnabled ? { scale: 0.96 } : undefined}
                  transition={microSpring}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl border text-sm font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25',
                    dropdownOpen
                      ? 'border-white/20 bg-white/[0.10] text-white'
                      : 'border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08]',
                  )}
                >
                  {initial}
                </motion.button>
                <AnimatePresence>
                  {dropdownOpen ? (
                    <motion.div
                      initial={
                        isMotionEnabled
                          ? { opacity: 0, y: -6, scale: 0.97 }
                          : false
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={
                        isMotionEnabled
                          ? { opacity: 0, y: -6, scale: 0.97 }
                          : undefined
                      }
                      transition={NAVBAR_POPUP_TRANSITION}
                      role="menu"
                      className="absolute right-0 top-[calc(100%+0.65rem)] w-[min(19rem,calc(100vw-1.5rem))] bg-zinc-950/93 border-white/10 backdrop-blur-2xl mt-4 rounded-2xl p-1.5 text-zinc-200 shadow-2xl shadow-black/50"
                    >
                      <div className="border-b border-white/8 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-white">
                            {firstName}
                          </p>
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-zinc-400">
                            {roleLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {user.email}
                        </p>
                      </div>
                      <div className="mt-1 grid gap-1">
                        {links.map((link, index) => (
                          <motion.div
                            key={link.href}
                            initial={
                              isMotionEnabled ? { opacity: 0, x: -4 } : false
                            }
                            animate={{ opacity: 1, x: 0 }}
                            transition={
                              isMotionEnabled
                                ? { delay: index * 0.025, duration: 0.17 }
                                : { duration: 0 }
                            }
                          >
                            <Link
                              href={link.href}
                              role="menuitem"
                              onClick={() => setDropdownOpen(false)}
                              className={cn(
                                'flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25',
                                isActive(link.href)
                                  ? 'bg-white/[0.08] text-white'
                                  : 'text-zinc-300 hover:bg-white/[0.05] hover:text-white',
                              )}
                            >
                              {link.label}
                            </Link>
                          </motion.div>
                        ))}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleLogout()}
                          className="mt-1 flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/25"
                        >
                          {t('nav.logout', { defaultValue: 'Sair' })}
                        </button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </>
            ) : !loading ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 rounded-xl px-3 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                >
                  <Link href="/my-bookings">
                    {t('nav.manageBookings', {
                      defaultValue: 'As minhas marcações',
                    })}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-xl border-white/15 bg-white/[0.05] px-4 text-xs font-semibold text-white hover:border-white/25 hover:bg-white/[0.09]"
                >
                  <Link href="/login">
                    {t('nav.signIn', { defaultValue: 'Entrar' })}
                  </Link>
                </Button>
              </div>
            ) : null}

            <div className="lg:hidden">
              <LanguageSwitcher />
            </div>
            <motion.div
              whileTap={isMotionEnabled ? { scale: 0.95 } : undefined}
              transition={microSpring}
            >
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label={
                  open
                    ? t('dashboard.closeMenu', { defaultValue: 'Fechar menu' })
                    : t('dashboard.openMenu', { defaultValue: 'Abrir menu' })
                }
                aria-expanded={open}
                aria-controls="site-navigation-overlay"
                onClick={() => setOpen((current) => !current)}
                className="size-10 rounded-xl border-white/10 bg-white/[0.04] text-zinc-100 hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.98]"
              >
                <MenuIcon open={open} className="size-5" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="site-navigation-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={NAVBAR_TRANSITION}
            className="glassmorphism fixed inset-0 z-[150] flex flex-col bg-zinc-950/97 px-5 pb-8 pt-28 text-zinc-50 backdrop-blur-2xl sm:px-8 sm:pt-32"
            role="dialog"
            aria-modal="true"
            aria-label={t('dashboard.mainNavigation', {
              defaultValue: 'Menu de navegação',
            })}
          >
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-y-auto">
              <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/8 pb-5 sm:mb-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Silentra
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {user
                      ? `${firstName} · ${roleLabel}`
                      : locale === 'pt'
                        ? 'Navegação'
                        : 'Navigation'}
                  </p>
                </div>
              </div>
              <nav
                aria-label={
                  locale === 'pt' ? 'Navegação móvel' : 'Mobile navigation'
                }
                className="grid gap-1"
              >
                {links.map((link, index) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={
                        active && !link.href.startsWith('/#')
                          ? 'page'
                          : undefined
                      }
                      className={cn(
                        'group flex min-h-14 items-center rounded-2xl border px-4 font-heading text-2xl font-semibold tracking-tight transition-[background-color,border-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 sm:min-h-16 sm:px-5 sm:text-4xl',
                        active
                          ? 'border-white/12 bg-white/[0.07] text-white'
                          : 'border-transparent text-zinc-300 hover:border-white/8 hover:bg-white/[0.04] hover:text-white',
                      )}
                    >
                      <span className="mr-4 flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-xs font-medium text-zinc-500 transition-colors group-hover:text-zinc-300 sm:size-8">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 truncate">{link.label}</span>
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="ml-auto size-2 rounded-full bg-white/80"
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
              {!loading && !user ? (
                <div className="mt-auto grid gap-2 border-t border-white/8 pt-6 sm:flex sm:items-center sm:justify-end">
                  <Button
                    asChild
                    variant="ghost"
                    className="min-h-12 rounded-xl justify-center text-zinc-300 hover:bg-white/[0.06] hover:text-white sm:min-w-40"
                  >
                    <Link href="/my-bookings" onClick={() => setOpen(false)}>
                      {t('nav.manageBookings', {
                        defaultValue: 'As minhas marcações',
                      })}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="min-h-12 rounded-xl border-white/15 bg-white/[0.05] text-white hover:border-white/25 hover:bg-white/[0.09] sm:min-w-40"
                  >
                    <Link href="/login" onClick={() => setOpen(false)}>
                      {t('nav.signIn', { defaultValue: 'Entrar' })}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
