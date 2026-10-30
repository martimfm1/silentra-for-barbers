'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useBarbershop } from '@/context/BarbershopContext';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_METRIC_DESCRIPTORS,
  MetricKey,
} from '@/app/dashboard/_constants';
import { Appointment, Professional, Service, Client } from '@/types';
import { appointmentService } from '@/app/dashboard/_services/appointments.service';
import { servicesService } from '@/app/dashboard/_services/services.service';
import { professionalService } from '@/app/dashboard/_services/professionals.service';
import { authService } from '@/app/dashboard/_services/auth.service';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Users,
  Scissors,
  Briefcase,
  CalendarDays,
  Clock,
  ChevronRight,
  Crown,
  CalendarPlus,
  ArrowRight,
  CheckCircle2,
  QrCode,
  Heart,
  Gift,
  MessageCircle,
  BarChart3,
  CreditCard,
  Megaphone,
  Zap,
  Settings2,
  X,
} from 'lucide-react';
import { PLAN_NAMES } from '@/lib/billing/plan-features';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardPage() {
  const { locale, t } = useLanguage();
  const { barbershopId, loading: isLoadingBarbershop } = useBarbershop();
  const { plan, hasFeature } = useFeatureAccess();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(['metrics', 'chart', 'upcoming', 'next']);
  const [visibleShortcuts, setVisibleShortcuts] = useState<string[]>(['booking', 'clients', 'services', 'team', 'stats', 'loyalty-scan', 'qr', 'rewards']);

  const fetchInitialData = useCallback(async () => {
    if (!barbershopId) {
      setLoadingInitial(false);
      return;
    }
    setLoadingInitial(true);
    try {
      const [appointmentsResult, servicesResult, professionalsResult, clientsResult] =
        await Promise.allSettled([
          appointmentService.getAll(barbershopId),
          servicesService.getAll(barbershopId),
          professionalService.getAll(barbershopId),
          appointmentService.getClients(barbershopId),
        ]);

      if (appointmentsResult.status === 'rejected') {
        throw appointmentsResult.reason;
      }
      if (appointmentsResult.value.error) {
        throw appointmentsResult.value.error;
      }
      setAppointments(appointmentsResult.value.data ?? []);

      let secondaryDataFailed = false;
      if (servicesResult.status === 'fulfilled' && !servicesResult.value.error) {
        setServices(servicesResult.value.data ?? []);
      } else {
        secondaryDataFailed = true;
        console.error('[Dashboard Services Sync Error]');
      }

      if (professionalsResult.status === 'fulfilled' && !professionalsResult.value.error) {
        setProfessionals(professionalsResult.value.data ?? []);
      } else {
        secondaryDataFailed = true;
        console.error('[Dashboard Professionals Sync Error]');
      }

      if (clientsResult.status === 'fulfilled' && !clientsResult.value.error) {
        setClients(clientsResult.value.data ?? []);
      } else {
        secondaryDataFailed = true;
        console.error('[Dashboard Clients Sync Error]');
      }

      if (secondaryDataFailed) toast.error(t('dashboard.updateError'));
    } catch (error) {
      console.error('[Dashboard Appointments Sync Error]:', error);
      toast.error(t('dashboard.updateError'));
    } finally {
      setLoadingInitial(false);
    }
  }, [barbershopId, t]);

  useEffect(() => {
    if (isLoadingBarbershop) return;
    if (!barbershopId) {
      setLoadingInitial(false);
      return;
    }
    queueMicrotask(() => void fetchInitialData());
  }, [barbershopId, fetchInitialData, isLoadingBarbershop]);

  useEffect(() => {
    let cancelled = false;
    void authService.getCurrentUser().then(({ data }) => {
      if (cancelled || !data) return;
      setUserId(data.id ?? null);
      setUserName(data.name_complete || data.email?.split('@')[0] || null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const preferencesStorageKey = userId && barbershopId ? `silentra:dashboard-preferences:${userId}:${barbershopId}` : null;

  useEffect(() => {
    if (!preferencesStorageKey) return;
    try {
      const saved = localStorage.getItem(preferencesStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { widgets?: unknown; shortcuts?: unknown };
        if (Array.isArray(parsed.widgets)) setVisibleWidgets(parsed.widgets.filter((value): value is string => typeof value === 'string'));
        if (Array.isArray(parsed.shortcuts)) setVisibleShortcuts(parsed.shortcuts.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      localStorage.removeItem(preferencesStorageKey);
    } finally {
      setPreferencesReady(true);
    }
  }, [preferencesStorageKey]);

  useEffect(() => {
    if (!preferencesReady || !preferencesStorageKey) return;
    localStorage.setItem(preferencesStorageKey, JSON.stringify({ widgets: visibleWidgets, shortcuts: visibleShortcuts }));
  }, [preferencesReady, preferencesStorageKey, visibleWidgets, visibleShortcuts]);

  const togglePreference = (list: string[], setList: (value: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const dynamicChartData = useMemo(() => {
    const days = [
      t('dashboard.dayMon'),
      t('dashboard.dayTue'),
      t('dashboard.dayWed'),
      t('dashboard.dayThu'),
      t('dashboard.dayFri'),
      t('dashboard.daySat'),
      t('dashboard.daySun'),
    ];
    const values = days.map((day) => ({ day, revenue: 0, bookings: 0 }));

    for (const appointment of appointments) {
      const date = new Date(appointment.date_hour);
      if (!Number.isFinite(date.getTime())) continue;

      const dayIndex = (date.getDay() + 6) % 7;
      const point = values[dayIndex];
      point.bookings += 1;

      if (appointment.status === 'completed') {
        const price = Number(appointment.services?.price ?? 0);
        if (Number.isFinite(price)) point.revenue += price;
      }
    }

    return values;
  }, [appointments, t]);

  const hasChartActivity = dynamicChartData.some(
    (point) => point.bookings > 0 || point.revenue > 0,
  );

  const maxRevenue = Math.max(1, ...dynamicChartData.map((point) => point.revenue));
  const maxBookings = Math.max(1, ...dynamicChartData.map((point) => point.bookings));

  const metrics = useMemo(() => {
    const totalRevenue = appointments
      .filter((a) => a.status === 'completed')
      .reduce((acc, app) => acc + Number(app.services?.price || 0), 0);
    const activeBookingsCount = appointments.filter(
      (a) => a.status === 'scheduled',
    ).length;
    const valuesMap: Record<MetricKey, string> = {
      revenue: `${totalRevenue.toFixed(2)} €`,
      appointments: String(activeBookingsCount),
      clients: String(clients.length),
      services: String(services.length),
    };
    return DASHBOARD_METRIC_DESCRIPTORS.map((descriptor) => ({
      ...descriptor,
      label: t(`dashboard.${descriptor.key}`),
      value: valuesMap[descriptor.key],
    }));
  }, [appointments, clients, services, t]);

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'scheduled' || a.status === 'pending')
        .sort(
          (a, b) =>
            new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime(),
        )
        .slice(0, 5),
    [appointments],
  );

  const nextAppointment = upcomingAppointments[0];
  const hasBusinessSetup = services.length > 0 && professionals.length > 0;
  const setupSteps = [
    {
      label: t('dashboard.addService'),
      done: services.length > 0,
      href: '/dashboard/servicos',
    },
    {
      label: t('dashboard.addBarber'),
      done: professionals.length > 0,
      href: '/dashboard/equipa',
    },
    {
      label: t('dashboard.firstBooking'),
      done: appointments.length > 0,
      href: '/dashboard/agenda',
    },
  ];
  const setupCompleted = setupSteps.filter((step) => step.done).length;
  const nextSetupStep = setupSteps.find((step) => !step.done);

  const iconVariants = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400',
    default: 'bg-white/5 text-zinc-300',
  } as const;
  const cardHoverVariants = {
    emerald: 'hover:border-emerald-500/40 hover:bg-emerald-500/10',
    blue: 'hover:border-blue-500/40 hover:bg-blue-500/10',
    amber: 'hover:border-amber-500/40 hover:bg-amber-500/10',
    purple: 'hover:border-purple-500/40 hover:bg-purple-500/10',
    default: 'hover:border-zinc-500/40 hover:bg-zinc-500/10',
  } as const;
  const quickActions = [
    { id: 'booking', href: '/dashboard/agenda', label: t('dashboard.newBooking'), icon: CalendarPlus, color: 'emerald' as const },
    { id: 'clients', href: '/dashboard/clientes', label: t('dashboard.clients'), icon: Users, color: 'blue' as const },
    { id: 'services', href: '/dashboard/servicos', label: t('dashboard.services'), icon: Scissors, color: 'amber' as const },
    { id: 'team', href: '/dashboard/equipa', label: t('dashboard.team'), icon: Briefcase, color: 'purple' as const, feature: 'team_management' },
    { id: 'stats', href: '/dashboard/analytics', label: t('dashboard.stats'), icon: BarChart3, color: 'blue' as const, feature: 'advanced_analytics' },
    { id: 'loyalty-scan', href: '/dashboard/loyalty/validate', label: t('dashboard.scanLoyalty'), icon: QrCode, color: 'emerald' as const, feature: 'loyalty' },
    { id: 'qr', href: '/dashboard/qr-code', label: t('dashboard.barbershopQr'), icon: QrCode, color: 'purple' as const },
    { id: 'rewards', href: '/dashboard/loyalty', label: t('dashboard.loyaltyRewards'), icon: Gift, color: 'amber' as const, feature: 'loyalty' },
    { id: 'messages', href: '/dashboard/mensagens', label: t('dashboard.messages'), icon: MessageCircle, color: 'blue' as const, feature: 'messaging' },
    { id: 'marketing', href: '/dashboard/marketing', label: t('dashboard.marketing'), icon: Megaphone, color: 'purple' as const, feature: 'marketing_campaigns' },
    { id: 'automations', href: '/dashboard/automations', label: t('dashboard.automations'), icon: Zap, color: 'amber' as const, feature: 'marketing_campaigns' },
    { id: 'sales', href: '/dashboard/pos', label: t('dashboard.pos'), icon: CreditCard, color: 'emerald' as const, feature: 'pos' },
  ].filter((action) => !action.feature || hasFeature(action.feature as Parameters<typeof hasFeature>[0]));
  const visibleQuickActions = quickActions.filter((action) => visibleShortcuts.includes(action.id));
  const widgetOptions = [
    { id: 'metrics', label: t('dashboard.widgetMetrics') },
    { id: 'chart', label: t('dashboard.widgetChart') },
    { id: 'upcoming', label: t('dashboard.widgetUpcoming') },
    { id: 'next', label: t('dashboard.widgetNext') },
  ];

  return (
    <TooltipProvider>
      <main className="relative min-h-screen overflow-hidden pb-5 pt-16 text-foreground">
        <div className="relative px-3 pb-5 pt-8 sm:px-5 md:px-8 md:pb-12">
          <section
            className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            aria-labelledby="dashboard-greeting"
          >
            <div>
              <h1
                id="dashboard-greeting"
                className="mt-1 font-heading text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl"
              >
                {new Date().getHours() < 12
                  ? 'Bom dia'
                  : new Date().getHours() < 20
                    ? 'Boa tarde'
                    : 'Boa noite'}
                {userName ? `, ${userName}` : ''} 👋
              </h1>
              <p className="mt-1 text-sm capitalize text-zinc-400">
                {new Date().toLocaleDateString('pt-PT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className="glassmorphism inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Crown className="size-4 text-emerald-400" aria-hidden="true" />
              Plano atual: {PLAN_NAMES[plan]}
              <ChevronRight
                className="size-4 text-zinc-500"
                aria-hidden="true"
              />
            </Link>
          </section>

          {!loadingInitial && nextSetupStep && !hasBusinessSetup && (
            <section
              className="mb-6 overflow-hidden rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5 backdrop-blur-xl sm:p-6"
              aria-labelledby="setup-title"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/15">
                      {setupCompleted + 1}
                    </span>
                    {t('dashboard.setupTitle')}
                  </div>
                  <h2
                    id="setup-title"
                    className="mt-3 text-xl font-semibold tracking-tight text-zinc-50"
                  >
                    {t('dashboard.setupSubtitle')}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    {t('dashboard.setupProgress', {
                      completed: setupCompleted,
                      total: setupSteps.length,
                    })}
                    Só falta completar o próximo passo para começares a aceitar
                    marcações.
                  </p>
                  <div
                    className="mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-white/10"
                    role="progressbar"
                    aria-valuenow={setupCompleted}
                    aria-valuemin={0}
                    aria-valuemax={setupSteps.length}
                    aria-label={t('dashboard.setupProgress', {
                      completed: setupCompleted,
                      total: setupSteps.length,
                    })}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{
                        width: `${(setupCompleted / setupSteps.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <Link
                  href={nextSetupStep.href}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {nextSetupStep.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          )}

          <section aria-label={t('dashboard.quickActions')} className="pb-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">{t('dashboard.quickActions')}</h2>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPreferencesOpen(true)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label={t('dashboard.customizeDashboard')}>
                  <Settings2 className="size-3.5" aria-hidden="true" />{t('dashboard.customize')}
                </button>
                <Link href="/dashboard/agenda" className="text-xs font-medium text-zinc-500 transition hover:text-zinc-200">{t('dashboard.openAgenda')} →</Link>
              </div>
            </div>
            {visibleQuickActions.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleQuickActions.map((action) => { const Icon = action.icon; return <Link key={action.id} href={action.href} className="glassmorphism group flex min-h-[68px] min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:p-4">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl border', iconVariants[action.color])}><Icon className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 text-sm font-semibold tracking-tight text-zinc-50">{action.label}</span>
              </Link>; })}
            </div> : <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">{t('dashboard.noShortcuts')} <button type="button" onClick={() => setPreferencesOpen(true)} className="ml-1 text-emerald-300 underline underline-offset-4">{t('dashboard.addShortcuts')}</button></div>}
          </section>

          {visibleWidgets.includes('next') && nextAppointment && !loadingInitial && (
            <section
              className="glassmorphism mb-5 rounded-3xl border border-white/10 bg-zinc-900/60 p-4 shadow-xl backdrop-blur-xl sm:p-5"
              aria-labelledby="next-appointment-title"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                    <span className="text-sm font-bold">
                      {new Date(nextAppointment.date_hour).toLocaleTimeString(
                        'pt-PT',
                        { hour: '2-digit', minute: '2-digit' },
                      )}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                      {t('dashboard.nextAppointment')}
                    </p>
                    <h2
                      id="next-appointment-title"
                      className="mt-1 truncate text-base font-semibold text-zinc-50"
                    >
                      {nextAppointment.users?.name_complete ||
                        nextAppointment.manual_name ||
                        'Cliente'}
                    </h2>
                    <p className="mt-1 truncate text-sm text-zinc-400">
                      {nextAppointment.services?.name || t('dashboard.service')}{' '}
                      ·{' '}
                      {nextAppointment.professionals?.name ||
                        t('dashboard.noBarberAssigned')}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/agenda"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  Ver agenda{' '}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </section>
          )}

          {visibleWidgets.includes('metrics') && <section className="pt-1" aria-labelledby="business-overview">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="business-overview"
                className="font-heading text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400"
              >
                {t('dashboard.businessSummary')}
              </h2>
              {!loadingInitial && (
                <span className="text-xs text-zinc-500">
                  {services.length} serviços · {professionals.length}{' '}
                  profissionais
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {loadingInitial
                ? [...Array(4)].map((_, i) => (
                    <Card
                      key={i}
                      className="border border-white/10 bg-white/[0.04]"
                    >
                      <CardHeader className="flex flex-row items-center justify-between p-4 space-y-0">
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-24 bg-white/10" />
                          <Skeleton className="h-7 w-16 bg-white/10" />
                        </div>
                        <Skeleton className="size-10 rounded-full bg-white/10" />
                      </CardHeader>
                    </Card>
                  ))
                : metrics.map((metric) => (
                    <Link
                      key={metric.key}
                      href="/dashboard/stats"
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Card
                        className={cn(
                          'glassmorphism cursor-pointer border border-white/10 bg-white/[0.04] transition-all duration-200',
                          cardHoverVariants[metric.variant],
                        )}
                      >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                          <div className="min-w-0 space-y-1">
                            <CardDescription className="truncate text-xs font-medium text-zinc-400">
                              {metric.label}
                            </CardDescription>
                            <CardTitle className="truncate text-2xl font-bold tracking-tight text-zinc-50">
                              {metric.value}
                            </CardTitle>
                          </div>
                          <span
                            className={cn(
                              'flex size-10 shrink-0 items-center justify-center rounded-full',
                              iconVariants[metric.variant],
                            )}
                          >
                            <metric.icon className="size-5" />
                          </span>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
            </div>
          </section>

          {(visibleWidgets.includes('chart') || visibleWidgets.includes('upcoming')) && <section className={cn("grid gap-3 pt-5 md:gap-4", visibleWidgets.includes('chart') && visibleWidgets.includes('upcoming') ? "lg:grid-cols-[1fr_360px]" : "grid-cols-1")}>
            {visibleWidgets.includes('chart') && <Card className="glassmorphism border border-white/10 bg-zinc-900/60 shadow-xl backdrop-blur-xl">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-medium text-zinc-100">
                      {locale === 'en' ? 'Weekly activity by weekday' : 'Atividade por dia da semana'}
                    </CardTitle>
                    <CardDescription className="mt-1 text-zinc-500">
                      {t('dashboard.compareDaily')}
                    </CardDescription>
                  </div>
                  <Link
                    href="/dashboard/stats"
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-200"
                  >
                    {t('dashboard.viewAnalytics')}
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="h-[310px] min-w-0 w-full pt-4">
                {!loadingInitial && !hasChartActivity ? (
                  <div className="flex h-full min-h-[240px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                    <CalendarDays className="size-6 text-zinc-500" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-zinc-200">
                      {locale === 'en' ? 'No bookings to chart yet' : 'Ainda não existem marcações para apresentar'}
                    </p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                      {locale === 'en' ? 'Bookings and completed service revenue will appear here when the barbershop has appointments.' : 'As marcações e a receita dos serviços concluídos aparecerão aqui quando existirem marcações.'}
                    </p>
                  </div>
                ) : (
                  <div
                    className="flex h-full min-h-[250px] min-w-0 flex-col"
                    role="img"
                    aria-label={locale === 'en' ? 'Bar chart comparing completed revenue and bookings by weekday' : 'Gráfico de barras que compara a receita concluída e as marcações por dia da semana'}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                      <span>{locale === 'en' ? 'Relative scale for each metric' : 'Escala relativa para cada indicador'}</span>
                      <span>{locale === 'en' ? 'Hover or tap a bar for details' : 'Passa o cursor ou toca numa barra para ver detalhes'}</span>
                    </div>
                    <div className="relative min-h-0 flex-1">
                      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                        {[0, 1, 2, 3].map((line) => (
                          <div key={line} className="border-t border-dashed border-white/[0.08]" />
                        ))}
                      </div>
                      <div className="relative grid h-full min-w-0 grid-cols-7 gap-1 sm:gap-3">
                        {dynamicChartData.map((point) => {
                          const revenueHeight = point.revenue > 0 ? Math.max(8, (point.revenue / maxRevenue) * 100) : 2;
                          const bookingsHeight = point.bookings > 0 ? Math.max(8, (point.bookings / maxBookings) * 100) : 2;
                          return (
                            <div key={point.day} className="flex min-w-0 flex-col items-center justify-end gap-2">
                              <div className="flex h-full w-full items-end justify-center gap-1.5">
                                <div
                                  title={locale === 'en' ? `${point.day}: ${point.revenue.toFixed(2)} EUR in completed service revenue` : `${point.day}: ${point.revenue.toFixed(2).replace('.', ',')} € de receita de serviços concluídos`}
                                  aria-label={locale === 'en' ? `${point.day}, revenue ${point.revenue.toFixed(2)} euros` : `${point.day}, receita ${point.revenue.toFixed(2)} euros`}
                                  className="w-1/2 max-w-7 rounded-t-md bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.16)] transition-[height,filter] hover:brightness-125"
                                  style={{ height: `${revenueHeight}%`, minHeight: point.revenue > 0 ? '8px' : '2px' }}
                                />
                                <div
                                  title={locale === 'en' ? `${point.day}: ${point.bookings} bookings` : `${point.day}: ${point.bookings} marcações`}
                                  aria-label={locale === 'en' ? `${point.day}, ${point.bookings} bookings` : `${point.day}, ${point.bookings} marcações`}
                                  className="w-1/2 max-w-7 rounded-t-md bg-sky-400 shadow-[0_0_18px_rgba(96,165,250,0.15)] transition-[height,filter] hover:brightness-125"
                                  style={{ height: `${bookingsHeight}%`, minHeight: point.bookings > 0 ? '8px' : '2px' }}
                                />
                              </div>
                              <span className="w-full truncate text-center text-[10px] text-zinc-400 sm:text-xs">{point.day}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-zinc-500 sm:text-xs">
                      <span>{locale === 'en' ? `Peak revenue: ${maxRevenue.toFixed(2)} €` : `Receita máxima: ${maxRevenue.toFixed(2).replace('.', ',')} €`}</span>
                      <span className="text-right">{locale === 'en' ? `Peak bookings: ${maxBookings}` : `Marcações máximas: ${maxBookings}`}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <div
                className="flex flex-wrap items-center justify-center gap-4 px-5 pb-5 pt-1 text-xs text-zinc-500"
                aria-label={t('dashboard.chartLegend')}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]"
                    aria-hidden="true"
                  />
                  <span className="text-zinc-300">{locale === 'en' ? 'Revenue' : 'Receita'}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.4)]"
                    aria-hidden="true"
                  />
                  <span className="text-zinc-300">
                    {t('dashboard.appointmentsLabel')}
                  </span>
                </span>
              </div>
            </Card>}

            {visibleWidgets.includes('upcoming') && <Card className="glassmorphism border border-white/10 bg-zinc-900/60 shadow-xl backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg font-medium text-zinc-100">
                  <CalendarDays
                    className="size-4 text-emerald-400"
                    aria-hidden="true"
                  />
                  {t('dashboard.upcomingAppointments')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {loadingInitial ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full bg-white/10" />
                    ))}
                  </div>
                ) : upcomingAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
                    <CheckCircle2
                      className="mx-auto size-6 text-zinc-600"
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-sm font-medium text-zinc-300">
                      Tudo tranquilo por agora
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t('dashboard.upcomingAppointmentsEmpty')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingAppointments.map((appointment) => (
                      <Link
                        key={appointment.id}
                        href="/dashboard/agenda"
                        className="glassmorphism group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] p-3 transition hover:border-white/10 hover:bg-white/[0.05]"
                      >
                        <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]">
                          <span className="text-xs font-semibold text-zinc-200">
                            {new Date(appointment.date_hour).toLocaleTimeString(
                              'pt-PT',
                              { hour: '2-digit', minute: '2-digit' },
                            )}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(appointment.date_hour).toLocaleDateString(
                              'pt-PT',
                              { day: '2-digit', month: '2-digit' },
                            )}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-200">
                            {appointment.users?.name_complete ||
                              appointment.manual_name ||
                              'Cliente'}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {appointment.services?.name ||
                              t('dashboard.service')}
                          </p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>}
          </section>}
        </div>
      </main>
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-emerald-400" />{t('dashboard.customizeDashboard')}</DialogTitle>
            <DialogDescription className="text-zinc-400">{t('dashboard.customizeDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <section className="space-y-3"><h3 className="text-sm font-semibold text-zinc-200">{t('dashboard.dashboardWidgets')}</h3>
              {widgetOptions.map((option) => <label key={option.id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm"><span>{option.label}</span><input type="checkbox" checked={visibleWidgets.includes(option.id)} onChange={() => togglePreference(visibleWidgets, setVisibleWidgets, option.id)} className="size-4 accent-emerald-400" /></label>)}
            </section>
            <section className="space-y-3"><h3 className="text-sm font-semibold text-zinc-200">{t('dashboard.shortcuts')}</h3><p className="text-xs text-zinc-500">{t('dashboard.shortcutsDescription')}</p>
              {quickActions.map((action) => { const Icon = action.icon; return <label key={action.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm"><Icon className="size-4 text-zinc-400" /><span className="min-w-0 flex-1">{action.label}</span><input type="checkbox" checked={visibleShortcuts.includes(action.id)} onChange={() => togglePreference(visibleShortcuts, setVisibleShortcuts, action.id)} className="size-4 accent-emerald-400" /></label>; })}
            </section>
          </div>
          <div className="flex flex-wrap justify-between gap-2"><Button type="button" variant="ghost" onClick={() => { setVisibleWidgets(['metrics','chart','upcoming','next']); setVisibleShortcuts(['booking','clients','services','team','stats','loyalty-scan','qr','rewards']); }} className="text-zinc-300">{t('dashboard.resetDashboard')}</Button><Button type="button" onClick={() => setPreferencesOpen(false)} className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400">{t('common.done')}</Button></div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
