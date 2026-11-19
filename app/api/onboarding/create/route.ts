import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isRecord, normalizeText } from '@/lib/validation';
import {
  WEEKDAY_KEYS,
  validateWeeklySchedule,
  type WeeklySchedule,
} from '@/lib/scheduling/weekly-schedule';

function isWeeklySchedule(value: unknown): value is WeeklySchedule {
  if (!isRecord(value)) return false;
  return WEEKDAY_KEYS.every((dayKey) => {
    const day = value[dayKey];
    if (
      !isRecord(day) ||
      typeof day.day_off !== 'boolean' ||
      !Array.isArray(day.work_intervals) ||
      !Array.isArray(day.break_intervals)
    ) {
      return false;
    }
    return [...day.work_intervals, ...day.break_intervals].every(
      (interval) =>
        isRecord(interval) &&
        typeof interval.start === 'string' &&
        typeof interval.end === 'string',
    );
  });
}

async function POST__unobserved(request: Request) {
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

    const weeklySchedule = body.weeklySchedule;
    if (!isWeeklySchedule(weeklySchedule)) {
      return NextResponse.json(
        { error: 'Os horários semanais são inválidos.' },
        { status: 400 },
      );
    }
    const scheduleError = validateWeeklySchedule(weeklySchedule, 'pt');
    if (scheduleError || !WEEKDAY_KEYS.some((dayKey) => !weeklySchedule[dayKey].day_off)) {
      return NextResponse.json(
        { error: scheduleError ?? 'Define pelo menos um dia de funcionamento.' },
        { status: 400 },
      );
    }

    const numericPrice =
      typeof body.price === 'number' ? body.price : Number(body.price);
    const serviceName = normalizeText(body.serviceName, 100);
    const serviceDuration =
      typeof body.serviceDuration === 'number'
        ? body.serviceDuration
        : Number(body.serviceDuration);
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
        (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
      (latitude === null) !== (longitude === null)
    ) {
      return NextResponse.json(
        { error: 'Os dados de preço ou localização são inválidos.' },
        { status: 400 },
      );
    }
    if (
      !serviceName ||
      !Number.isInteger(serviceDuration) ||
      serviceDuration < 1 ||
      serviceDuration > 1440
    ) {
      return NextResponse.json(
        { error: 'Indica um serviço e uma duração entre 1 e 1440 minutos.' },
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

    const { data: onboardingResult, error: onboardingError } = await supabase.rpc(
      'create_barbershop_onboarding_with_weekly_schedule',
      {
        p_name: normalizedName,
        p_address: normalizedAddress,
        p_city: normalizedCity,
        p_price: numericPrice,
        p_tags: tags,
        p_lat: latitude,
        p_lng: longitude,
        p_service_name: serviceName,
        p_service_duration: serviceDuration,
        p_weekly_schedule: weeklySchedule,
      },
    );

    if (onboardingError || !isRecord(onboardingResult)) {
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

      if (code === '22023') {
        return NextResponse.json(
          { error: 'Os horários semanais ou os dados do primeiro serviço são inválidos.' },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: 'Não foi possível criar a barbearia. Tenta novamente.' },
        { status: 500 },
      );
    }

    const barbershopId = onboardingResult.barbershop_id;
    const serviceId = onboardingResult.service_id;
    const professionalId = onboardingResult.professional_id;
    if (
      typeof barbershopId !== 'string' ||
      typeof serviceId !== 'string' ||
      typeof professionalId !== 'string' ||
      onboardingResult.weekly_schedule_persisted !== true
    ) {
      console.error('[ONBOARDING_CREATE_INVALID_RESULT]');
      return NextResponse.json(
        { error: 'O onboarding não confirmou todos os dados iniciais.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      barbershopId,
      serviceId,
      professionalId,
      role: 'owner',
      persisted: true,
    });
  } catch (error) {
    console.error('[ONBOARDING_CRITICAL_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    );
  }
}

export const POST = withApiObservability(
  '/api/onboarding/create',
  POST__unobserved,
);
