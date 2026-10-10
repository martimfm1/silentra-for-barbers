import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  moduleErrorResponse,
  requireModuleContext,
} from '@/services/modules/authorization';
import { PLANS } from '@/lib/stripe/constants';

export const runtime = 'nodejs';
const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

type AppointmentRow = {
  id: string;
  date_hour: string;
  status: string;
  value_products: number | string | null;
  service: { name: string; price: number | string } | null;
  professional: { name: string } | null;
  client_id: string | null;
  manual_birth_date: string | null;
  user: { birth_date: string | null } | null;
};
type PosRow = {
  id: string;
  created_at: string;
  total: number | string;
  status: string;
  location_id: string | null;
};
type AgeGroup = { label: string; count: number };

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}
function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
function money(value: number) {
  return Math.round(value * 100) / 100;
}
function calculateAge(birthDate: string, referenceDate: Date) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > referenceDate) return null;
  let age = referenceDate.getFullYear() - birth.getFullYear();
  const month = referenceDate.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && referenceDate.getDate() < birth.getDate()))
    age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}
function ageGroup(age: number) {
  if (age < 18) return 'Menos de 18';
  if (age <= 24) return '18–24';
  if (age <= 34) return '25–34';
  if (age <= 44) return '35–44';
  if (age <= 54) return '45–54';
  if (age <= 64) return '55–64';
  return '65+';
}

async function GET__unobserved(request: Request) {
  try {
    const { admin, barbershopId, plan } =
      await requireModuleContext('advanced_analytics');
    const url = new URL(request.url);
    const now = new Date();
    const from = startOfDay(
      parseDate(
        url.searchParams.get('from'),
        new Date(now.getTime() - 29 * DAY_MS),
      ),
    );
    const to = endOfDay(parseDate(url.searchParams.get('to'), now));
    if (to < from)
      return NextResponse.json(
        { error: 'Invalid date range' },
        { status: 400 },
      );
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS)
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
        { status: 400 },
      );

    const { data: appointments, error: appointmentsError } = await admin
      .from('appointments')
      .select(
        'id,date_hour,status,value_products,client_id,manual_birth_date,service:services(name,price),professional:professionals(name),user:users(birth_date)',
      )
      .eq('barbershop_id', barbershopId)
      .gte('date_hour', from.toISOString())
      .lte('date_hour', to.toISOString());
    if (appointmentsError) throw appointmentsError;
    const rows = (appointments ?? []) as unknown as AppointmentRow[];
    const completed = rows.filter((row) => row.status === 'completed');
    const scheduled = rows.filter((row) => row.status === 'scheduled');
    const cancelled = rows.filter((row) => row.status === 'cancelled');
    const revenueByDay = new Map<string, number>();
    const serviceStats = new Map<
      string,
      { bookings: number; revenue: number }
    >();
    const professionalStats = new Map<
      string,
      { bookings: number; revenue: number }
    >();
    const clientIds = new Set<string>();
    const clientAgeGroups = new Map<string, Set<string>>();

    for (const row of completed) {
      const revenue =
        Number(row.service?.price ?? 0) + Number(row.value_products ?? 0);
      const safeRevenue = Number.isFinite(revenue) ? revenue : 0;
      const day = row.date_hour.slice(0, 10);
      revenueByDay.set(day, money((revenueByDay.get(day) ?? 0) + safeRevenue));
      if (row.service?.name) {
        const current = serviceStats.get(row.service.name) ?? {
          bookings: 0,
          revenue: 0,
        };
        current.bookings += 1;
        current.revenue = money(current.revenue + safeRevenue);
        serviceStats.set(row.service.name, current);
      }
      if (row.professional?.name) {
        const current = professionalStats.get(row.professional.name) ?? {
          bookings: 0,
          revenue: 0,
        };
        current.bookings += 1;
        current.revenue = money(current.revenue + safeRevenue);
        professionalStats.set(row.professional.name, current);
      }
      if (row.client_id) {
        clientIds.add(row.client_id);
        const birthDate = row.user?.birth_date ?? row.manual_birth_date;
        if (birthDate) {
          const age = calculateAge(birthDate, new Date(row.date_hour));
          if (age !== null) {
            const group = ageGroup(age);
            const set = clientAgeGroups.get(group) ?? new Set<string>();
            set.add(row.client_id);
            clientAgeGroups.set(group, set);
          }
        }
      }
    }

    const orderedAgeLabels = [
      'Menos de 18',
      '18–24',
      '25–34',
      '35–44',
      '45–54',
      '55–64',
      '65+',
    ];
    const ageInsights: AgeGroup[] = orderedAgeLabels
      .map((label) => ({ label, count: clientAgeGroups.get(label)?.size ?? 0 }))
      .filter((item) => item.count > 0);
    const { count: newClients, error: clientsError } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', barbershopId)
      .eq('role', 'client')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString());
    if (clientsError) throw clientsError;
    const { count: totalClients, error: totalClientsError } = await admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', barbershopId)
      .eq('role', 'client');
    if (totalClientsError) throw totalClientsError;
    const revenue = money(
      completed.reduce(
        (sum, row) =>
          sum +
          Number(row.service?.price ?? 0) +
          Number(row.value_products ?? 0),
        0,
      ),
    );
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(
      previousTo.getTime() - (to.getTime() - from.getTime()),
    );
    const { data: previousAppointments, error: previousError } = await admin
      .from('appointments')
      .select('status,value_products,service:services(price)')
      .eq('barbershop_id', barbershopId)
      .gte('date_hour', previousFrom.toISOString())
      .lte('date_hour', previousTo.toISOString());
    if (previousError) throw previousError;
    const previousRevenue = money(
      (
        (previousAppointments ?? []) as unknown as Array<{
          status: string;
          value_products: number | string | null;
          service: { price: number | string } | null;
        }>
      )
        .filter((row) => row.status === 'completed')
        .reduce(
          (sum, row) =>
            sum +
            Number(row.service?.price ?? 0) +
            Number(row.value_products ?? 0),
          0,
        ),
    );

    const response: Record<string, unknown> = {
      plan,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        previousFrom: previousFrom.toISOString(),
        previousTo: previousTo.toISOString(),
      },
      overview: {
        revenue,
        previousRevenue,
        revenueChangePercent:
          previousRevenue === 0
            ? null
            : money(((revenue - previousRevenue) / previousRevenue) * 100),
        appointments: rows.length,
        completedAppointments: completed.length,
        scheduledAppointments: scheduled.length,
        cancelledAppointments: cancelled.length,
        cancellationRate:
          rows.length === 0 ? 0 : money((cancelled.length / rows.length) * 100),
        newClients: newClients ?? 0,
        totalClients: totalClients ?? 0,
        activeClientsInPeriod: clientIds.size,
      },
      revenueByDay: Array.from(revenueByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value })),
      topServices: Array.from(serviceStats.entries())
        .map(([name, stats]) => ({
          name,
          count: stats.bookings,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      professionals: Array.from(professionalStats.entries())
        .map(([name, stats]) => ({
          name,
          appointments: stats.bookings,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      clientAgeGroups: ageInsights,
    };

    if (plan === PLANS.ENTERPRISE) {
      const { data: posTransactions, error: posError } = await admin
        .from('pos_transactions')
        .select('id,created_at,total,status,location_id')
        .eq('barbershop_id', barbershopId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .limit(5000);
      if (posError) throw posError;
      const posRows = (posTransactions ?? []) as PosRow[];
      const completedPos = posRows.filter((row) => row.status === 'completed');
      const posRevenue = money(
        completedPos.reduce((sum, row) => sum + Number(row.total), 0),
      );
      const locationStats = new Map<
        string,
        { transactions: number; revenue: number }
      >();
      for (const row of completedPos) {
        const key = row.location_id ?? 'main';
        const current = locationStats.get(key) ?? {
          transactions: 0,
          revenue: 0,
        };
        current.transactions += 1;
        current.revenue = money(current.revenue + Number(row.total));
        locationStats.set(key, current);
      }
      response.enterprise = {
        posRevenue,
        posTransactions: completedPos.length,
        combinedRevenue: money(revenue + posRevenue),
        locations: Array.from(locationStats.entries())
          .map(([locationId, stats]) => ({ locationId, ...stats }))
          .sort((a, b) => b.revenue - a.revenue),
      };
    }
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    const response = moduleErrorResponse(error);
    if (response) return response;
    console.error('Analytics API error', error);
    return NextResponse.json(
      { error: 'Unable to load analytics' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/analytics', GET__unobserved);
