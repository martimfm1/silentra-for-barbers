import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { getPortalSession, hashPortalToken } from '@/lib/customer-booking-portal';
import { createCustomerCalendarFeedToken } from '@/lib/customer-calendar-feed';
import { getPublicAppUrl } from '@/lib/email/calendar-link';
import { assertSameOrigin } from '@/services/billing/http';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function responseError(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function buildFeedUrl(token: string): string {
  const url = new URL('/api/customer-portal/calendar', getPublicAppUrl());
  url.searchParams.set('token', token);
  return url.toString();
}

async function GET__unobserved(request: Request) {
  const session = await getPortalSession(request);
  if (!session) return responseError('Confirma novamente o teu email para gerir o calendário.', 401);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('customer_calendar_feeds')
    .select('version,enabled')
    .eq('email', session.email)
    .maybeSingle();

  if (error) {
    console.error('[CUSTOMER_CALENDAR_SETTINGS_READ_ERROR]', error.code ?? 'UNKNOWN');
    return responseError('Não foi possível carregar a sincronização do calendário.', 503);
  }

  const enabled = data?.enabled === true;
  const token = enabled
    ? createCustomerCalendarFeedToken(session.email, Number(data?.version ?? 1))
    : null;

  return NextResponse.json(
    { success: true, enabled, feedUrl: token ? buildFeedUrl(token) : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function POST__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return responseError('A origem do pedido não pôde ser validada.', 403);
  }

  const session = await getPortalSession(request);
  if (!session) return responseError('Confirma novamente o teu email para gerir o calendário.', 401);

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from('customer_calendar_feeds')
    .select('version')
    .eq('email', session.email)
    .maybeSingle();

  if (readError) {
    console.error('[CUSTOMER_CALENDAR_SETTINGS_READ_ERROR]', readError.code ?? 'UNKNOWN');
    return responseError('Não foi possível gerar o link do calendário.', 503);
  }

  const version = Math.max(0, Number(current?.version ?? 0)) + 1;
  const token = createCustomerCalendarFeedToken(session.email, version);
  const { error: saveError } = await admin
    .from('customer_calendar_feeds')
    .upsert(
      {
        email: session.email,
        token_hash: hashPortalToken(token),
        version,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );

  if (saveError) {
    console.error('[CUSTOMER_CALENDAR_SETTINGS_SAVE_ERROR]', saveError.code ?? 'UNKNOWN');
    return responseError('Não foi possível gerar o link do calendário.', 503);
  }

  return NextResponse.json(
    { success: true, enabled: true, feedUrl: buildFeedUrl(token) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function DELETE__unobserved(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return responseError('A origem do pedido não pôde ser validada.', 403);
  }

  const session = await getPortalSession(request);
  if (!session) return responseError('Confirma novamente o teu email para gerir o calendário.', 401);

  const admin = createAdminClient();
  const { error } = await admin
    .from('customer_calendar_feeds')
    .delete()
    .eq('email', session.email);

  if (error) {
    console.error('[CUSTOMER_CALENDAR_SETTINGS_DELETE_ERROR]', error.code ?? 'UNKNOWN');
    return responseError('Não foi possível desativar a sincronização.', 503);
  }

  return NextResponse.json(
    { success: true, enabled: false, feedUrl: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withApiObservability('/api/customer-portal/calendar/settings', GET__unobserved);
export const POST = withApiObservability('/api/customer-portal/calendar/settings', POST__unobserved);
export const DELETE = withApiObservability('/api/customer-portal/calendar/settings', DELETE__unobserved);
