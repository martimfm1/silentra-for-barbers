import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  MarketplaceBarbershopRelation,
  MarketplaceShopRecord,
} from '@/types/marketplace/shops';
import { mapRecordToMarketplaceShopResponse } from '@/lib/marketplace/shop-mappers';
import {
  getDailySchedule,
  isSlotWithinDailySchedule,
  normalizeWeeklySchedule,
  timeToMinutes,
  type LegacyScheduleInput,
  type WeeklySchedule,
} from '@/lib/scheduling/weekly-schedule';

type ShopRelation = MarketplaceBarbershopRelation & {
  lunch_start?: string | null;
  lunch_end?: string | null;
  is_public_in_directory?: boolean | null;
  weekly_schedule?: unknown;
};
type ShopRecord = Omit<MarketplaceShopRecord, 'barbershops'> & {
  rating?: number | null;
  reviews_count?: number | null;
  barbershops: ShopRelation | ShopRelation[] | null;
};

function lisbonDate(offsetDays: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = new Date(
    `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}T12:00:00`,
  );
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function isValidCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDiff = rad(bLat - aLat);
  const lngDiff = rad(bLng - aLng);
  const distance =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(lngDiff / 2) ** 2;
  return (
    earthRadiusKm * 2 * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance))
  );
}

type ProfessionalScheduleRecord = {
  id: string;
  barbershop_id: string;
  weekly_schedule?: unknown;
};

type BookedInterval = {
  professionalId: string | null;
  start: number;
  end: number;
};

function hasAvailableSlot(
  record: ShopRecord,
  professionals: ProfessionalScheduleRecord[],
  booked: BookedInterval[],
  date: string,
) {
  const relation = Array.isArray(record.barbershops)
    ? record.barbershops[0]
    : record.barbershops;
  if (!relation || professionals.length === 0) return false;

  const shopSchedule = normalizeWeeklySchedule(
    relation.weekly_schedule,
    relation as LegacyScheduleInput,
  );
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const today = lisbonDate(0);
  const now = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const nowMinutes =
    Number(now.find((part) => part.type === 'hour')?.value ?? 0) * 60 +
    Number(now.find((part) => part.type === 'minute')?.value ?? 0);

  for (const professional of professionals) {
    const schedule: WeeklySchedule = professional.weekly_schedule
      ? normalizeWeeklySchedule(professional.weekly_schedule)
      : shopSchedule;
    const day = getDailySchedule(schedule, weekday);
    if (day.day_off) continue;

    for (const period of day.work_intervals) {
      const from = timeToMinutes(period.start);
      const to = timeToMinutes(period.end);
      for (let slot = from; slot + 30 <= to; slot += 30) {
        if (date === today && slot <= nowMinutes) continue;
        if (!isSlotWithinDailySchedule(day, slot, slot + 30)) continue;
        const conflicts = booked.some(
          (appointment) =>
            (!appointment.professionalId ||
              appointment.professionalId === professional.id) &&
            slot < appointment.end &&
            slot + 30 > appointment.start,
        );
        if (!conflicts) return true;
      }
    }
  }
  return false;
}
async function GET__unobserved(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('query')?.trim() ?? '';
    if (rawQuery.length > 160)
      return NextResponse.json(
        { error: 'Pesquisa demasiado longa.' },
        { status: 400 },
      );

    const query = rawQuery.toLocaleLowerCase();
    const filter = searchParams.get('filter') ?? 'All';
    if (!['All', 'Near Me', 'Top Rated'].includes(filter))
      return NextResponse.json({ error: 'Filtro inválido.' }, { status: 400 });

    const requestedDate = searchParams.get('date');
    const isIsoDate = Boolean(
      requestedDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
      !Number.isNaN(new Date(`${requestedDate}T12:00:00`).getTime()),
    );
    const date =
      requestedDate === 'Tomorrow'
        ? lisbonDate(1)
        : isIsoDate
          ? requestedDate!
          : lisbonDate(0);

    const latitude = Number(searchParams.get('lat'));
    const longitude = Number(searchParams.get('lng'));
    const hasLatitude = searchParams.has('lat');
    const hasLongitude = searchParams.has('lng');
    if (
      (hasLatitude || hasLongitude) &&
      !isValidCoordinates(latitude, longitude)
    )
      return NextResponse.json(
        { error: 'Localização inválida.' },
        { status: 400 },
      );
    const canMeasureDistance = isValidCoordinates(latitude, longitude);

    const supabase = await createClient();
    const admin = createAdminClient();
    const { data, error } = await supabase
      .from('shops')
      .select(
        `id, barbershop_id, slug, city, price, tags, lat, lng, is_active, rating, reviews_count, barbershops!inner ( name, address, opening_time, closing_time, lunch_start, lunch_end, closed_days, weekly_schedule, is_public_in_directory )`,
      )
      .eq('is_active', true)
      .eq('barbershops.is_public_in_directory', true);

    if (error) {
      console.error('[SHOPS_GET_ERROR]', error);
      return NextResponse.json(
        { error: 'Não foi possível carregar as barbearias.' },
        { status: 500 },
      );
    }

    const records = ((data as unknown as ShopRecord[]) ?? []).filter(
      (record) => {
        const relation = Array.isArray(record.barbershops)
          ? record.barbershops[0]
          : record.barbershops;
        if (relation?.is_public_in_directory !== true) return false;
        if (!query) return true;
        return [
          relation?.name,
          relation?.address,
          record.city,
          ...(record.tags ?? []),
        ].some((value) => value?.toLocaleLowerCase().includes(query));
      },
    );

    const barbershopIds = records
      .map((record) => record.barbershop_id)
      .filter(Boolean);
    let professionals: ProfessionalScheduleRecord[] = [];
    let appointments: {
      barbershop_id: string;
      professional_id: string | null;
      date_hour: string;
      duration_minutes: number | null;
    }[] = [];

    if (barbershopIds.length > 0) {
      const [professionalsResult, appointmentsResult] = await Promise.all([
        admin
          .from('professionals')
          .select('id,barbershop_id,weekly_schedule')
          .in('barbershop_id', barbershopIds)
          .eq('active', true),
        admin
          .from('appointments')
          .select('barbershop_id,professional_id,date_hour,duration_minutes')
          .in('barbershop_id', barbershopIds)
          .in('status', ['pending', 'scheduled'])
          .gte('date_hour', `${date}T00:00:00`)
          .lte('date_hour', `${date}T23:59:59`),
      ]);

      if (professionalsResult.error || appointmentsResult.error) {
        console.error('[SHOPS_AVAILABILITY_ERROR]', {
          professionals: professionalsResult.error?.code ?? null,
          appointments: appointmentsResult.error?.code ?? null,
        });
        return NextResponse.json(
          { error: 'Não foi possível validar os horários disponíveis.' },
          { status: 503 },
        );
      }

      professionals = (professionalsResult.data ?? []) as ProfessionalScheduleRecord[];
      appointments = (appointmentsResult.data ?? []) as typeof appointments;
    }

    const professionalsByShop = new Map<string, ProfessionalScheduleRecord[]>();
    for (const professional of (professionals ?? []) as ProfessionalScheduleRecord[]) {
      const current = professionalsByShop.get(professional.barbershop_id) ?? [];
      current.push(professional);
      professionalsByShop.set(professional.barbershop_id, current);
    }

    const bookedByShop = new Map<string, BookedInterval[]>();
    for (const appointment of appointments ?? []) {
      const time = appointment.date_hour?.split('T')[1]?.slice(0, 5) ?? '';
      const [hours, minutesPart] = time.split(':').map(Number);
      if (!Number.isFinite(hours) || !Number.isFinite(minutesPart)) continue;
      const start = hours * 60 + minutesPart;
      const duration = Math.max(1, Number(appointment.duration_minutes ?? 30));
      const current = bookedByShop.get(appointment.barbershop_id) ?? [];
      current.push({
        professionalId: appointment.professional_id ?? null,
        start,
        end: start + duration,
      });
      bookedByShop.set(appointment.barbershop_id, current);
    }

    const shops = records
      .filter((record) =>
        hasAvailableSlot(
          record,
          professionalsByShop.get(record.barbershop_id) ?? [],
          bookedByShop.get(record.barbershop_id) ?? [],
          date,
        ),
      )
      .map((record) => {
        const shop = mapRecordToMarketplaceShopResponse(record);
        const distanceKm =
          canMeasureDistance &&
          isValidCoordinates(Number(record.lat), Number(record.lng))
            ? haversineKm(
                latitude,
                longitude,
                Number(record.lat),
                Number(record.lng),
              )
            : null;
        return {
          ...shop,
          distanceKm: distanceKm === null ? 0 : Number(distanceKm.toFixed(1)),
        };
      });

    if (filter === 'Near Me' && canMeasureDistance)
      shops.sort((a, b) => a.distanceKm - b.distanceKm);
    if (filter === 'Top Rated')
      shops.sort(
        (a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount,
      );

    return NextResponse.json(
      { data: shops },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    console.error('[SHOPS_INTERNAL_ERROR]', error);
    return NextResponse.json(
      { error: 'Ocorreu um erro ao carregar as barbearias.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/shops', GET__unobserved);
