import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/stripe/constants';
import { normalizeWeeklySchedule } from '@/lib/scheduling/weekly-schedule';
import { filterEligibleReportPeriods, getClosedReportPeriods, type PeriodReportPreference, type PeriodReportType, type PeriodReportWindow } from '@/lib/analytics/periodic-reports';
import { UUID_PATTERN } from '@/lib/validation';
import { readJsonObject } from '@/lib/security/request-validation';
import { moduleErrorResponse, requireModuleContext } from '@/services/modules/authorization';

export const runtime = 'nodejs';
type Admin = Awaited<ReturnType<typeof requireModuleContext>>['admin'];
type Appointment = {
  id: string;
  date_hour: string;
  status: string;
  value_products: number | string | null;
  service_price: number | string | null;
  client_id: string | null;
  manual_name: string | null;
  service: { name: string; price: number | string } | null;
};
type PosSale = { total: number | string | null; created_at: string };
type Metrics = {
  revenue: number;
  serviceRevenue: number;
  productRevenue: number;
  pointOfSaleRevenue: number;
  previousRevenue: number;
  revenueChangePercent: number | null;
  appointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  cancellationRate: number;
  averageTicket: number;
  uniqueClients: number;
  newClients: number;
  rebookedClients: number;
  rebookingRate: number | null;
  topService: { name: string; count: number; revenue: number } | null;
  bestRevenueDay: { date: string; revenue: number } | null;
  busiestDay: { date: string; appointments: number } | null;
  pointOfSaleTransactions: number;
};
type SavedReport = {
  id: string;
  period_type: 'day' | 'week' | 'month';
  period_start: string;
  period_end: string;
  data: Metrics;
  viewed_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const number = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value: number) => Math.round(value * 100) / 100;

function portugalDate(value: string): string {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return values.year + '-' + values.month + '-' + values.day;
}

async function loadAppointments(
  admin: Admin, shopId: string, from: string, to: string,
): Promise<Appointment[]> {
  const result: Appointment[] = [];
  for (let offset = 0; offset < 10_000; offset += 1_000) {
    const { data, error } = await admin.from('appointments')
      .select('id,date_hour,status,value_products,service_price,client_id,manual_name,service:services(name,price)')
      .eq('barbershop_id', shopId).gte('date_hour', from).lt('date_hour', to)
      .order('date_hour', { ascending: true }).range(offset, offset + 999);
    if (error) throw error;
    const page = (data ?? []) as unknown as Appointment[];
    result.push(...page);
    if (page.length < 1_000) break;
  }
  return result;
}

async function loadPosSales(
  admin: Admin, shopId: string, from: string, to: string,
): Promise<PosSale[]> {
  const { data, error } = await admin.from('pos_transactions')
    .select('total,created_at').eq('barbershop_id', shopId).eq('status', 'completed')
    .gte('created_at', from).lt('created_at', to).limit(10_000);
  if (error) throw error;
  return (data ?? []) as PosSale[];
}

function servicePrice(row: Appointment): number {
  // Prefer the price captured when the booking was created; fall back only for legacy rows.
  return number(row.service_price ?? row.service?.price);
}

function bookingRevenue(rows: Appointment[]): number {
  return round(rows.filter((row) => row.status === 'completed').reduce(
    (sum, row) => sum + servicePrice(row) + number(row.value_products), 0,
  ));
}

async function calculate(
  admin: Admin, shopId: string, plan: string, period: PeriodReportWindow,
): Promise<Metrics> {
  const enterprise = plan === PLANS.ENTERPRISE;
  const [rows, previousRows, newClients, pos, previousPos] = await Promise.all([
    loadAppointments(admin, shopId, period.startAt, period.endAt),
    loadAppointments(admin, shopId, period.previousStartAt, period.previousEndAt),
    admin.from('users').select('id', { count: 'exact', head: true })
      .eq('barbershop_id', shopId).eq('role', 'client')
      .gte('created_at', period.startAt).lt('created_at', period.endAt),
    enterprise ? loadPosSales(admin, shopId, period.startAt, period.endAt) : Promise.resolve([] as PosSale[]),
    enterprise ? loadPosSales(admin, shopId, period.previousStartAt, period.previousEndAt) : Promise.resolve([] as PosSale[]),
  ]);
  if (newClients.error) throw newClients.error;

  const completed = rows.filter((row) => row.status === 'completed');
  const cancelled = rows.filter((row) => row.status === 'cancelled');
  const serviceRevenue = round(completed.reduce((sum, row) => sum + servicePrice(row), 0));
  const productRevenue = round(completed.reduce((sum, row) => sum + number(row.value_products), 0));
  const posRevenue = round(pos.reduce((sum, row) => sum + number(row.total), 0));
  const previousRevenue = round(bookingRevenue(previousRows) +
    previousPos.reduce((sum, row) => sum + number(row.total), 0));
  const revenue = round(serviceRevenue + productRevenue + posRevenue);
  const clients = new Set<string>();
  const linkedClients = new Set<string>();
  const services = new Map<string, { name: string; count: number; revenue: number }>();
  const dailyRevenue = new Map<string, number>();
  const dailyBookings = new Map<string, number>();

  for (const row of completed) {
    if (row.client_id) {
      clients.add(row.client_id);
      linkedClients.add(row.client_id);
    } else if (row.manual_name?.trim()) {
      clients.add('manual:' + row.manual_name.trim().toLocaleLowerCase('pt-PT'));
    }
    const name = row.service?.name?.trim();
    if (name) {
      const current = services.get(name) ?? { name, count: 0, revenue: 0 };
      current.count += 1;
      current.revenue = round(current.revenue + servicePrice(row));
      services.set(name, current);
    }
    const day = portugalDate(row.date_hour);
    dailyRevenue.set(day, round((dailyRevenue.get(day) ?? 0) +
      servicePrice(row) + number(row.value_products)));
  }

  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    const day = portugalDate(row.date_hour);
    dailyBookings.set(day, (dailyBookings.get(day) ?? 0) + 1);
  }
  for (const sale of pos) {
    const day = portugalDate(sale.created_at);
    dailyRevenue.set(day, round((dailyRevenue.get(day) ?? 0) + number(sale.total)));
  }

  let rebooked = 0;
  const clientIds = Array.from(linkedClients);
  for (let offset = 0; offset < clientIds.length; offset += 100) {
    const { data, error } = await admin.from('appointments').select('client_id')
      .eq('barbershop_id', shopId).in('client_id', clientIds.slice(offset, offset + 100))
      .gte('date_hour', period.endAt).in('status', ['pending', 'scheduled']).limit(1_000);
    if (error) throw error;
    rebooked += new Set((data ?? []).map((row) => row.client_id)
      .filter((id): id is string => typeof id === 'string')).size;
  }

  const topService = Array.from(services.values()).sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const bestRevenueDay = Array.from(dailyRevenue, ([date, value]) => ({ date, revenue: value }))
    .sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const busiestDay = Array.from(dailyBookings, ([date, count]) => ({ date, appointments: count }))
    .sort((a, b) => b.appointments - a.appointments)[0] ?? null;

  return {
    revenue, serviceRevenue, productRevenue, pointOfSaleRevenue: posRevenue, previousRevenue,
    revenueChangePercent: previousRevenue === 0 ? null : round(((revenue - previousRevenue) / previousRevenue) * 100),
    appointments: rows.length, completedAppointments: completed.length,
    cancelledAppointments: cancelled.length,
    cancellationRate: rows.length === 0 ? 0 : round((cancelled.length / rows.length) * 100),
    averageTicket: completed.length === 0 ? 0 : round((serviceRevenue + productRevenue) / completed.length),
    uniqueClients: clients.size, newClients: newClients.count ?? 0, rebookedClients: rebooked,
    rebookingRate: linkedClients.size === 0 ? null : round((rebooked / linkedClients.size) * 100),
    topService, bestRevenueDay, busiestDay, pointOfSaleTransactions: pos.length,
  };
}

async function GET__unobserved(request: Request) {
  try {
    const { admin, barbershopId, plan } = await requireModuleContext(
      'basic_dashboard', 'dashboard', request,
    );
    const { data: shop, error: shopError } = await admin.from('barbershops')
      .select('weekly_schedule,opening_time,closing_time,lunch_start,lunch_end,closed_days,periodic_reports_daily_enabled,periodic_reports_weekly_enabled,periodic_reports_monthly_enabled,periodic_reports_daily_enabled_at,periodic_reports_weekly_enabled_at,periodic_reports_monthly_enabled_at')
      .eq('id', barbershopId).maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return NextResponse.json({ error: 'Barbershop not found' }, { status: 404 });

    const preferences: Record<PeriodReportType, PeriodReportPreference> = {
      day: {
        enabled: shop.periodic_reports_daily_enabled !== false,
        enabledAt: shop.periodic_reports_daily_enabled_at ?? null,
      },
      week: {
        enabled: shop.periodic_reports_weekly_enabled !== false,
        enabledAt: shop.periodic_reports_weekly_enabled_at ?? null,
      },
      month: {
        enabled: shop.periodic_reports_monthly_enabled !== false,
        enabledAt: shop.periodic_reports_monthly_enabled_at ?? null,
      },
    };
    const periods = filterEligibleReportPeriods(
      getClosedReportPeriods(new Date(), normalizeWeeklySchedule(shop.weekly_schedule, shop)),
      preferences,
    );
    const earliest = periods.reduce(
      (value, period) => period.startDate < value ? period.startDate : value,
      periods[0]?.startDate ?? '9999-12-31',
    );
    const { data: existing, error: existingError } = await admin.from('barbershop_period_reports')
      .select('period_type,period_start').eq('barbershop_id', barbershopId)
      .gte('period_start', earliest).limit(120);
    if (existingError) throw existingError;
    const keys = new Set((existing ?? []).map((row) => row.period_type + ':' + row.period_start));
    const missing = periods.filter((period) => !keys.has(period.type + ':' + period.startDate));

    for (let offset = 0; offset < missing.length; offset += 3) {
      await Promise.all(missing.slice(offset, offset + 3).map(async (period) => {
        const data = await calculate(admin, barbershopId, plan, period);
        const { error } = await admin.from('barbershop_period_reports').upsert({
          barbershop_id: barbershopId, period_type: period.type,
          period_start: period.startDate, period_end: period.endDate, data,
        }, {
          onConflict: 'barbershop_id,period_type,period_start',
          ignoreDuplicates: true,
        });
        if (error) throw error;
      }));
    }

    const { data: reports, error: reportsError } = await admin.from('barbershop_period_reports')
      .select('id,period_type,period_start,period_end,data,viewed_at,completed_at,created_at')
      .eq('barbershop_id', barbershopId)
      .order('period_start', { ascending: false }).order('created_at', { ascending: false }).limit(500);
    if (reportsError) throw reportsError;
    const records = (reports ?? []) as unknown as SavedReport[];
    return NextResponse.json({
      reports: records,
      unreadReports: records.filter((report) => {
        const preference = preferences[report.period_type];
        return preference.enabled &&
          !report.completed_at &&
          (!preference.enabledAt ||
            new Date(report.created_at).getTime() >= new Date(preference.enabledAt).getTime());
      }),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('Periodic reports API error', error);
    return NextResponse.json({ error: 'Unable to load periodic reports' }, { status: 500 });
  }
}

async function PATCH__unobserved(request: Request) {
  try {
    const { admin, barbershopId } = await requireModuleContext(
      'basic_dashboard', 'dashboard', request,
    );
    const body = await readJsonObject(request, { maxBytes: 4096, allowedKeys: ['id', 'action', 'ids'] });
    if (!body.ok) return body.response;
    const action = typeof body.value.action === 'string' ? body.value.action : 'viewed';
    if (action === 'complete') {
      const rawIds = body.value.ids;
      if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 3) {
        return NextResponse.json({ error: 'Invalid report ids' }, { status: 400 });
      }
      const ids = rawIds.filter((id): id is string => typeof id === 'string');
      if (
        ids.length !== rawIds.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !UUID_PATTERN.test(id))
      ) {
        return NextResponse.json({ error: 'Invalid report ids' }, { status: 400 });
      }

      const { data: ownedReports, error: ownedError } = await admin.from('barbershop_period_reports')
        .select('id').eq('barbershop_id', barbershopId).in('id', ids);
      if (ownedError) throw ownedError;
      if ((ownedReports ?? []).length !== ids.length) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      const completedAt = new Date().toISOString();
      const { error: completionError } = await admin.from('barbershop_period_reports')
        .update({ viewed_at: completedAt, completed_at: completedAt })
        .eq('barbershop_id', barbershopId).in('id', ids);
      if (completionError) throw completionError;
      return NextResponse.json({ success: true, completedIds: ids });
    }

    if (action !== 'viewed') {
      return NextResponse.json({ error: 'Invalid report action' }, { status: 400 });
    }
    const id = typeof body.value.id === 'string' ? body.value.id : '';
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Invalid report id' }, { status: 400 });
    }
    const { data, error } = await admin.from('barbershop_period_reports')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', id).eq('barbershop_id', barbershopId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('Periodic report view update error', error);
    return NextResponse.json({ error: 'Unable to update periodic report' }, { status: 500 });
  }
}

export const GET = withApiObservability('/api/periodic-reports', GET__unobserved);
export const PATCH = withApiObservability('/api/periodic-reports', PATCH__unobserved);
