'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBarbershop } from '@/context/BarbershopContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import Link from 'next/link';

// SERVICES
import { appointmentService } from '@/app/dashboard/_services/appointments.service';

// UI COMPONENTS
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// RECHARTS
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

// ICONS
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Scissors,
  CheckCircle,
  Wallet,
  Receipt,
  Store,
  RefreshCw,
} from 'lucide-react';
import { Appointment } from '@/types';

const CHART_PALETTE = [
  '#10b981', // Emerald
  '#38bdf8', // Sky
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink
];

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { name?: string };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

function CustomChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0];
    const displayLabel =
      typeof label === 'string' && label.length > 0
        ? label
        : (item.name ?? item.payload?.name ?? '');
    return (
      <div
        role="tooltip"
        className="rounded-xl border border-white/10 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-md"
      >
        <p className="text-xs font-medium text-zinc-400">{displayLabel}</p>
        <p className="mt-0.5 text-sm font-bold text-zinc-100">
          {typeof item.value === 'number'
            ? `${item.value.toFixed(2)}€`
            : item.value}
        </p>
      </div>
    );
  }
  return null;
}

export default function StatsPage() {
  const { t } = useLanguage();
  const { barbershopId } = useBarbershop();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStatsData = useCallback(async () => {
    if (!barbershopId) return;
    try {
      setLoading(true);
      const res = await appointmentService.getAll(barbershopId);
      if (res.error) throw res.error;
      setAppointments(res.data || []);
    } catch (error) {
      console.error('❌ [Stats Fetch Error]:', error);
      toast.error(t('statsPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [barbershopId, t]);

  useEffect(() => {
    if (barbershopId) {
      queueMicrotask(() => void fetchStatsData());
    }
  }, [barbershopId, fetchStatsData]);

  const analytics = useMemo(() => {
    const completedApps = appointments.filter((a) => a.status === 'completed');

    let totalRevenue = 0;
    const serviceCounts: Record<
      string,
      { id: string | null; name: string; count: number; total: number }
    > = {};
    const paymentGroups: Record<string, number> = {};
    const professionalGroups: Record<string, number> = {};

    completedApps.forEach((app) => {
      const price = Number(app.services?.price || 0);
      const serviceName = app.services?.name || 'Outros';
      const serviceId = app.service_id || null;
      const paymentMethod = app.payment_method || t('statsPage.unspecified');
      const barberName = app.professionals?.name || 'Casa / Geral';

      totalRevenue += price;

      const key = serviceId || serviceName;

      if (!serviceCounts[key]) {
        serviceCounts[key] = {
          id: serviceId,
          name: serviceName,
          count: 0,
          total: 0,
        };
      }
      serviceCounts[key].count += 1;
      serviceCounts[key].total += price;

      paymentGroups[paymentMethod] =
        (paymentGroups[paymentMethod] || 0) + price;

      professionalGroups[barberName] =
        (professionalGroups[barberName] || 0) + price;
    });

    const avgTicket =
      completedApps.length > 0 ? totalRevenue / completedApps.length : 0;

    let mostPopularService = t('statsPage.noRecords');
    let mostPopularServiceId: string | null = null;
    let maxCount = 0;

    Object.values(serviceCounts).forEach((data) => {
      if (data.count > maxCount) {
        maxCount = data.count;
        mostPopularService = data.name;
        mostPopularServiceId = data.id;
      }
    });

    return {
      insights: {
        totalRevenue,
        avgTicket,
        mostPopular: mostPopularService,
        mostPopularId: mostPopularServiceId,
        completedCount: completedApps.length,
      },
      paymentStats: Object.entries(paymentGroups).map(([name, value]) => ({
        name: name.toUpperCase(),
        value,
      })),
      professionalStats: Object.entries(professionalGroups).map(
        ([name, value]) => ({
          name,
          value,
        }),
      ),
      serviceStats: Object.values(serviceCounts)
        .map((data) => ({
          name: data.name,
          value: data.total,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    };
  }, [appointments]);

  const hasCompleted = analytics.insights.completedCount > 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
              <TrendingUp className="size-5" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white">
              {t('statsPage.title')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {t('statsPage.description')}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="ghost"
            onClick={() => void fetchStatsData()}
            disabled={loading}
            aria-label={t('statsPage.refresh')}
            className="min-h-[44px] bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-200 border border-white/10 text-xs sm:text-sm px-3 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
          >
            <RefreshCw
              className={`size-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="sr-only sm:not-sr-only sm:ml-2">Atualizar</span>
          </Button>
          <Link href="/dashboard" className="flex-1 sm:flex-none">
            <Button
              variant="ghost"
              className="w-full sm:w-auto min-h-[44px] bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-zinc-200 border border-white/10 text-xs sm:text-sm gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Voltar ao
              Painel
            </Button>
          </Link>
        </div>
      </header>

      {loading ? (
        <div role="status" aria-live="polite" className="space-y-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border border-white/10 bg-zinc-900/60">
                <CardHeader className="pb-2 p-4">
                  <Skeleton className="h-4 w-28 bg-white/10" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Skeleton className="h-8 w-20 bg-white/10" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border border-white/10 bg-zinc-900/60">
                <CardHeader className="p-4 border-b border-white/5">
                  <Skeleton className="h-4 w-36 bg-white/10" />
                </CardHeader>
                <CardContent className="h-[220px] sm:h-[260px] p-4">
                  <Skeleton className="h-full w-full bg-white/5" />
                </CardContent>
              </Card>
            ))}
          </div>
          <span className="sr-only">{t('statsPage.loading')}</span>
        </div>
      ) : (
        <>
          {/* ⚡ GRID DE KPIS */}
          <section aria-label={t('statsPage.summary')}>
            <dl className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border border-white/10 bg-zinc-900/60 shadow-lg">
                <CardHeader className="pb-1 p-4">
                  <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{t('statsPage.totalRevenue')}</span>
                    <Receipt
                      className="size-4 text-emerald-400"
                      aria-hidden="true"
                    />
                  </dt>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <dd className="text-2xl font-bold text-emerald-400">
                    {analytics.insights.totalRevenue.toFixed(2)}€
                  </dd>
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-zinc-900/60 shadow-lg">
                <CardHeader className="pb-1 p-4">
                  <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{t('statsPage.averageTicket')}</span>
                    <DollarSign
                      className="size-4 text-zinc-100"
                      aria-hidden="true"
                    />
                  </dt>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <dd className="text-2xl font-bold text-white">
                    {analytics.insights.avgTicket.toFixed(2)}€
                  </dd>
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-zinc-900/60 shadow-lg">
                <CardHeader className="pb-1 p-4">
                  <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Mais Solicitado</span>
                    <Scissors
                      className="size-4 text-purple-400"
                      aria-hidden="true"
                    />
                  </dt>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <dd
                    className="text-lg font-semibold text-zinc-100 truncate"
                    title={analytics.insights.mostPopular}
                  >
                    {analytics.insights.mostPopular}
                  </dd>
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-zinc-900/60 shadow-lg">
                <CardHeader className="pb-1 p-4">
                  <dt className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{t('statsPage.completedServices')}</span>
                    <CheckCircle
                      className="size-4 text-sky-400"
                      aria-hidden="true"
                    />
                  </dt>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <dd className="text-2xl font-bold text-sky-400">
                    {analytics.insights.completedCount}{' '}
                    <span className="text-xs font-normal text-zinc-500">
                      cortes
                    </span>
                  </dd>
                </CardContent>
              </Card>
            </dl>
          </section>

          {!hasCompleted ? (
            <section
              aria-label={t('statsPage.noCompletedBookings')}
              className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/40 p-10 text-center"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400">
                <Store className="size-6" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-sm font-semibold text-zinc-200">
                {t('statsPage.noCompletedBookings')}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {t('statsPage.noCompletedBookingsHint')}
              </p>
              <Link
                href="/dashboard"
                className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
              >
                Ir para a agenda
              </Link>
            </section>
          ) : (
            <section
              aria-label={t('statsPage.charts')}
              className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            >
              {/* GRÁFICO 1: MÉTODOS DE PAGAMENTO */}
              <Card className="border border-white/10 bg-zinc-900/60 shadow-lg flex flex-col justify-between">
                <CardHeader className="p-4 border-b border-white/5">
                  <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Wallet
                      className="size-4 text-amber-400"
                      aria-hidden="true"
                    />{' '}
                    {t('statsPage.paymentFlow')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[220px] sm:h-[260px] p-2 pt-4">
                  {analytics.paymentStats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                      {t('statsPage.noHistory')}
                    </div>
                  ) : (
                    <>
                      <div className="sr-only">
                        {t('statsPage.paymentMethodsTable')}{' '}
                        {analytics.paymentStats
                          .map((s) => `${s.name}: ${s.value.toFixed(2)}€`)
                          .join(', ')}
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.paymentStats}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={5}
                            cornerRadius={4}
                            dataKey="value"
                          >
                            {analytics.paymentStats.map((_, index) => (
                              <Cell
                                key={index}
                                fill={
                                  CHART_PALETTE[index % CHART_PALETTE.length]
                                }
                                stroke="transparent"
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<CustomChartTooltip />} />
                          <Legend
                            verticalAlign="bottom"
                            height={28}
                            iconType="circle"
                            iconSize={8}
                            formatter={(value: string) => (
                              <span className="text-xs text-zinc-400">
                                {value}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* GRÁFICO 2: FATURAÇÃO POR BARBEIRO */}
              <Card className="stats-professional-chart border border-white/10 bg-zinc-900/60 shadow-lg flex flex-col justify-between">
                <CardHeader className="p-4 border-b border-white/5">
                  <CardTitle className="text-sm font-semibold text-zinc-200">
                    {t('statsPage.revenueByBarber')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[220px] sm:h-[260px] p-2 pt-4">
                  {analytics.professionalStats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                      {t('statsPage.noOperationalData')}
                    </div>
                  ) : (
                    <>
                      <div className="sr-only">
                        {t('statsPage.barberRevenue')}{' '}
                        {analytics.professionalStats
                          .map((s) => `${s.name}: ${s.value.toFixed(2)}€`)
                          .join(', ')}
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.professionalStats}
                          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.06)"
                          />
                          <XAxis
                            dataKey="name"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#a1a1aa', fontSize: 10 }}
                            dy={6}
                            angle={-20}
                            textAnchor="end"
                            height={48}
                            interval="preserveStartEnd"
                            minTickGap={4}
                            tickFormatter={(value: string) =>
                              value.length > 10
                                ? `${value.slice(0, 10)}…`
                                : value
                            }
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#a1a1aa', fontSize: 11 }}
                            tickFormatter={(value: number) => `${value}€`}
                          />
                          <RechartsTooltip content={<CustomChartTooltip />} />
                          <Bar
                            dataKey="value"
                            name={t('statsPage.revenue')}
                            fill="#38bdf8"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={48}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* GRÁFICO 3: TOP SERVIÇOS EM FATURAÇÃO */}
              <Card className="border border-white/10 bg-zinc-900/60 shadow-lg flex flex-col justify-between md:col-span-2 lg:col-span-1">
                <CardHeader className="p-4 border-b border-white/5">
                  <CardTitle className="text-sm font-semibold text-zinc-200">
                    {t('statsPage.topServices')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[220px] sm:h-[260px] p-2 pt-4">
                  {analytics.serviceStats.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                      {t('statsPage.noRecords')}
                    </div>
                  ) : (
                    <>
                      <div className="sr-only">
                        {t('statsPage.mostProfitableServices')}{' '}
                        {analytics.serviceStats
                          .map((s) => `${s.name}: ${s.value.toFixed(2)}€`)
                          .join(', ')}
                      </div>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.serviceStats}
                          layout="vertical"
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.06)"
                          />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            width={85}
                            tick={{ fill: '#a1a1aa', fontSize: 10 }}
                            tickFormatter={(value: string) =>
                              value.length > 14
                                ? `${value.slice(0, 14)}…`
                                : value
                            }
                          />
                          <RechartsTooltip
                            content={<CustomChartTooltip />}
                            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                          />
                          <Bar
                            dataKey="value"
                            name={t('statsPage.revenue')}
                            fill="#10b981"
                            radius={[0, 6, 6, 0]}
                            maxBarSize={22}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </main>
  );
}
