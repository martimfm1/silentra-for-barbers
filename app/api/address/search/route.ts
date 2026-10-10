import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';

const MAX_QUERY_LENGTH = 256;

interface MapboxFeature {
  id?: string;
  properties?: {
    name?: string;
    full_address?: string;
    address?: string;
    address_number?: string;
    street?: string;
    coordinates?: {
      longitude?: number;
      latitude?: number;
      accuracy?: string;
    };
    context?: Record<string, { name?: string; id?: string }>;
  };
  geometry?: {
    coordinates?: [number, number];
  };
}

function firstContextName(
  context: Record<string, { name?: string }> | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = context?.[key]?.name?.trim();
    if (value) return value;
  }
  return '';
}

async function GETHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  const query = searchParams.get('q')?.trim() ?? '';
  const postalCode = searchParams.get('postalCode')?.trim() ?? '';
  const houseNumber = searchParams.get('houseNumber')?.trim() ?? '';
  const city = searchParams.get('city')?.trim() ?? '';
  const latitude = Number(searchParams.get('lat'));
  const longitude = Number(searchParams.get('lng'));

  const searchQuery =
    postalCode.length >= 4
      ? `${houseNumber ? `${houseNumber} ` : ''}${postalCode}${city ? ` ${city}` : ''}`.trim()
      : query;

  if (searchQuery.length < 3) {
    return NextResponse.json(
      { suggestions: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (searchQuery.length > MAX_QUERY_LENGTH || searchQuery.includes(';')) {
    return NextResponse.json({ error: 'Pesquisa inválida.' }, { status: 400 });
  }

  if (!token) {
    console.error(
      '[ADDRESS_SEARCH_CONFIG_ERROR] MAPBOX_ACCESS_TOKEN is missing.',
    );
    return NextResponse.json(
      {
        error: 'A pesquisa de moradas está temporariamente indisponível.',
        suggestions: [],
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const params = new URLSearchParams({
      q: searchQuery,
      access_token: token,
      autocomplete: 'true',
      country: 'PT',
      language: 'pt-PT',
      limit: '6',
      types: 'address,street,place,postcode',
    });

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      params.set('proximity', `${longitude},${latitude}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      },
    ).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn('[ADDRESS_SEARCH_PROVIDER_ERROR]', response.status);
      return NextResponse.json(
        { error: 'Não foi possível pesquisar esta morada.', suggestions: [] },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const payload = (await response.json()) as { features?: MapboxFeature[] };
    const suggestions = (payload.features ?? [])
      .map((feature) => {
        const properties = feature.properties ?? {};
        const coordinates = properties.coordinates ?? {};
        const geometry = feature.geometry?.coordinates;
        const lat = Number(coordinates.latitude ?? geometry?.[1]);
        const lng = Number(coordinates.longitude ?? geometry?.[0]);
        const context = properties.context;
        const street =
          properties.street || firstContextName(context, ['street', 'address']);
        const number = properties.address_number || houseNumber;
        const detectedCity = firstContextName(context, [
          'place',
          'locality',
          'district',
          'municipality',
        ]);
        const detectedPostalCode = firstContextName(context, ['postcode']);
        const fullAddress =
          properties.full_address ||
          properties.address ||
          properties.name ||
          '';

        if (
          !feature.id ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          !fullAddress
        )
          return null;

        return {
          id: feature.id,
          streetWithNumber:
            `${street || properties.name || fullAddress}${number ? ` ${number}` : ''}`.trim(),
          fullAddress,
          city: detectedCity || city,
          postalCode: detectedPostalCode || postalCode,
          lat,
          lng,
          accuracy: coordinates.accuracy ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return NextResponse.json(
      { suggestions },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[ADDRESS_SEARCH_ERROR]',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { error: 'Não foi possível pesquisar esta morada.', suggestions: [] },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = withApiLogging('/api/address/search', GETHandler);
