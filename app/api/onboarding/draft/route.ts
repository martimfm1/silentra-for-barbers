import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isRecord } from '@/lib/validation';
import { isBoundedString, readJsonObject } from '@/lib/security/request-validation';
import { assertSameOrigin } from '@/services/billing/http';
import { BillingError } from '@/types/stripe';
import { WEEKDAY_KEYS, type WeeklySchedule } from '@/lib/scheduling/weekly-schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OnboardingDraft = {
  businessMode: 'solo' | 'team';
  shopName: string;
  address: string;
  doorNumber: string;
  postalCode: string;
  city: string;
  weeklySchedule: WeeklySchedule;
  price: number | '';
  firstServiceName: string;
  firstServiceDuration: string;
  tagsInput: string;
  lat: number | null;
  lng: number | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function isScheduleDraft(value: unknown): value is WeeklySchedule {
  if (!isRecord(value) || Object.keys(value).length !== WEEKDAY_KEYS.length) {
    return false;
  }

  return WEEKDAY_KEYS.every((dayKey) => {
    const day = value[dayKey];
    if (
      !isRecord(day) ||
      typeof day.day_off !== 'boolean' ||
      !Array.isArray(day.work_intervals) ||
      !Array.isArray(day.break_intervals) ||
      day.work_intervals.length > 4 ||
      day.break_intervals.length > 4
    ) {
      return false;
    }

    return [...day.work_intervals, ...day.break_intervals].every(
      (interval) =>
        isRecord(interval) &&
        typeof interval.start === 'string' &&
        interval.start.length <= 5 &&
        typeof interval.end === 'string' &&
        interval.end.length <= 5,
    );
  });
}

function normalizeDraft(value: unknown): OnboardingDraft | null {
  if (!isRecord(value)) return null;

  const {
    businessMode,
    shopName,
    address,
    doorNumber,
    postalCode,
    city,
    weeklySchedule,
    price,
    firstServiceName,
    firstServiceDuration,
    tagsInput,
    lat,
    lng,
  } = value;

  if (
    (businessMode !== 'solo' && businessMode !== 'team') ||
    !isBoundedString(shopName, { min: 0, max: 120 }) ||
    !isBoundedString(address, { min: 0, max: 240 }) ||
    !isBoundedString(doorNumber, { min: 0, max: 40 }) ||
    !isBoundedString(postalCode, { min: 0, max: 20 }) ||
    !isBoundedString(city, { min: 0, max: 100 }) ||
    !isScheduleDraft(weeklySchedule) ||
    !(price === '' || (
      typeof price === 'number' &&
      Number.isFinite(price) &&
      price >= 0 &&
      price <= 10_000
    )) ||
    !isBoundedString(firstServiceName, { min: 0, max: 100 }) ||
    !isBoundedString(firstServiceDuration, { min: 0, max: 4 }) ||
    !isBoundedString(tagsInput, { min: 0, max: 500 }) ||
    !(
      lat === null ||
      (typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90)
    ) ||
    !(
      lng === null ||
      (typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180)
    ) ||
    ((lat === null) !== (lng === null))
  ) {
    return null;
  }

  return {
    businessMode,
    shopName,
    address,
    doorNumber,
    postalCode,
    city,
    weeklySchedule,
    price,
    firstServiceName,
    firstServiceDuration,
    tagsInput,
    lat,
    lng,
  };
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user: error ? null : user };
}

async function GET__unobserved() {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return jsonError('Não autenticado.', 401);

    const { data, error } = await supabase
      .from('onboarding_drafts')
      .select('draft, updated_at, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[ONBOARDING_DRAFT_READ_FAILED]', error.code ?? 'UNKNOWN');
      return jsonError('Não foi possível recuperar o rascunho.', 503);
    }

    if (!data) {
      return NextResponse.json(
        { success: true, draft: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (Date.parse(data.expires_at) <= Date.now()) {
      await supabase.from('onboarding_drafts').delete().eq('user_id', user.id);
      return NextResponse.json(
        { success: true, draft: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const draft = normalizeDraft(data.draft);
    if (!draft) {
      await supabase.from('onboarding_drafts').delete().eq('user_id', user.id);
      return NextResponse.json(
        { success: true, draft: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(
      { success: true, draft, updatedAt: data.updated_at },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[ONBOARDING_DRAFT_READ_EXCEPTION]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return jsonError('Não foi possível recuperar o rascunho.', 500);
  }
}

async function PUT__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return jsonError('Não autenticado.', 401);

    const bodyResult = await readJsonObject(request, {
      maxBytes: 16 * 1024,
      allowedKeys: ['draft'],
    });
    if (!bodyResult.ok) return bodyResult.response;

    const draft = normalizeDraft(bodyResult.value.draft);
    if (!draft) {
      return jsonError('Os dados do rascunho não são válidos.', 400);
    }

    const now = new Date();
    const updatedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('onboarding_drafts').upsert(
      {
        user_id: user.id,
        draft,
        updated_at: updatedAt,
        expires_at: expiresAt,
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      console.error('[ONBOARDING_DRAFT_WRITE_FAILED]', error.code ?? 'UNKNOWN');
      return jsonError('Não foi possível guardar o rascunho.', 503);
    }

    return NextResponse.json(
      { success: true, updatedAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof BillingError && error.code === 'CSRF_VALIDATION_FAILED') {
      return jsonError(error.message, 403);
    }
    console.error(
      '[ONBOARDING_DRAFT_WRITE_EXCEPTION]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return jsonError('Não foi possível guardar o rascunho.', 500);
  }
}

async function DELETE__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return jsonError('Não autenticado.', 401);

    const { error } = await supabase
      .from('onboarding_drafts')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('[ONBOARDING_DRAFT_DELETE_FAILED]', error.code ?? 'UNKNOWN');
      return jsonError('Não foi possível limpar o rascunho.', 503);
    }

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof BillingError && error.code === 'CSRF_VALIDATION_FAILED') {
      return jsonError(error.message, 403);
    }
    console.error(
      '[ONBOARDING_DRAFT_DELETE_EXCEPTION]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return jsonError('Não foi possível limpar o rascunho.', 500);
  }
}

export const GET = withApiObservability('/api/onboarding/draft', GET__unobserved);
export const PUT = withApiObservability('/api/onboarding/draft', PUT__unobserved);
export const DELETE = withApiObservability('/api/onboarding/draft', DELETE__unobserved);
