import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isRecord, normalizeText } from '@/lib/validation';

function parseTime(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');

  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

async function POSTHandler(request: Request) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    const normalizedName = normalizeText(body.name, 120);
    const normalizedAddress = normalizeText(body.address, 240);
    const normalizedCity = normalizeText(body.city, 100);

    if (!normalizedName || !normalizedAddress || !normalizedCity) {
      return NextResponse.json(
        { error: 'Preenche o nome, a morada e a cidade.' },
        { status: 400 },
      );
    }

    const rawHours =
      typeof body.hours === 'string' ? body.hours : '09:00-19:00';
    const [rawOpen = '09:00', rawClose = '19:00'] = rawHours
      .split('-')
      .map((part) => part.trim());
    const openingTime = parseTime(rawOpen) ?? '09:00:00';
    const closingTime = parseTime(rawClose) ?? '19:00:00';

    const numericPrice =
      typeof body.price === 'number' ? body.price : Number(body.price);
    const latitude =
      body.lat == null || body.lat === '' ? null : Number(body.lat);
    const longitude =
      body.lng == null || body.lng === '' ? null : Number(body.lng);

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0 ||
      numericPrice > 10_000 ||
      (latitude !== null &&
        (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null &&
        (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      return NextResponse.json(
        { error: 'Os dados de preço ou localização são inválidos.' },
        { status: 400 },
      );
    }

    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter((tag): tag is string => typeof tag === 'string')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];

    const { data: barbershopId, error: onboardingError } = await supabase.rpc(
      'create_barbershop_onboarding',
      {
        p_name: normalizedName,
        p_address: normalizedAddress,
        p_city: normalizedCity,
        p_opening_time: openingTime,
        p_closing_time: closingTime,
        p_price: numericPrice,
        p_tags: tags,
        p_lat: latitude,
        p_lng: longitude,
      },
    );

    if (onboardingError || !barbershopId) {
      console.error('[ONBOARDING_CREATE_FAIL]', onboardingError);

      const code = onboardingError?.code;
      if (code === '23505') {
        return NextResponse.json(
          { error: 'Esta conta já tem uma barbearia associada.' },
          { status: 409 },
        );
      }

      if (code === '42501') {
        return NextResponse.json(
          { error: 'Não tens autorização para concluir este onboarding.' },
          { status: 403 },
        );
      }

      return NextResponse.json(
        { error: 'Não foi possível criar a barbearia. Tenta novamente.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      barbershopId,
      role: 'owner',
    });
  } catch (error) {
    console.error('[ONBOARDING_CRITICAL_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}

export const POST = withApiLogging('/api/onboarding/create', POSTHandler);
