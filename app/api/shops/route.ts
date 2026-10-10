import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type {
  MarketplaceBarbershopRelation,
  MarketplaceShopRecord,
} from '@/types/marketplace/shops';
import { mapRecordToMarketplaceShopResponse } from '@/lib/marketplace/shop-mappers';

type ShopRelation = MarketplaceBarbershopRelation & {
  lunch_start?: string | null;
  lunch_end?: string | null;
  is_public_in_directory?: boolean | null;
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

function minutes(time: string | null | undefined, fallback: number) {
  if (!time) return fallback;
  const [hours, mins] = time.split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(mins)
    ? hours * 60 + mins
    : fallback;
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

function hasAvailableSlot(
  record: ShopRecord,
  booked: Set<string>,
  date: string,
) {
  const relation = Array.isArray(record.barbershops)
    ? record.barbershops[0]
    : record.barbershops;
  const start = minutes(relation?.opening_time, 9 * 60);
  const end = minutes(relation?.closing_time, 19 * 60);
  const lunchStart = relation?.lunch_start
    ? minutes(relation.lunch_start, 0)
    : null;
  const lunchEnd = relation?.lunch_end ? minutes(relation.lunch_end, 0) : null;
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

  for (let slot = start; slot < end; slot += 30) {
    if (date === today && slot <= nowMinutes) continue;
    if (
      lunchStart !== null &&
      lunchEnd !== null &&
      slot >= lunchStart &&
      slot < lunchEnd
    )
      continue;
    const key = `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`;
    if (!booked.has(key)) return true;
  }
  return false;
}

async function GETHandler(request: Request) {
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
    const { data, error } = await supabase
      .from('shops')
      .select(
        `id, barbershop_id, slug, city, price, tags, lat, lng, is_active, rating, reviews_count, barbershops ( name, address, opening_time, closing_time, lunch_start, lunch_end, is_public_in_directory )`,
      )
      .eq('is_active', true);

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
        if (relation?.is_public_in_directory === false) return false;
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
    const { data: appointments } = barbershopIds.length
      ? await supabase
          .from('appointments')
          .select('barbershop_id, date_hour')
          .in('barbershop_id', barbershopIds)
          .gte('date_hour', `${date}T00:00:00`)
          .lte('date_hour', `${date}T23:59:59`)
      : { data: [] as { barbershop_id: string; date_hour: string }[] };

    const bookedByShop = new Map<string, Set<string>>();
    for (const appointment of appointments ?? []) {
      const time = appointment.date_hour?.split('T')[1]?.slice(0, 5) ?? '';
      if (!bookedByShop.has(appointment.barbershop_id))
        bookedByShop.set(appointment.barbershop_id, new Set());
      bookedByShop.get(appointment.barbershop_id)?.add(time);
    }

    const shops = records
      .filter((record) =>
        hasAvailableSlot(
          record,
          bookedByShop.get(record.barbershop_id) ?? new Set(),
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
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
          Vary: 'Accept-Encoding',
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

export const GET = withApiLogging('/api/shops', GETHandler);
