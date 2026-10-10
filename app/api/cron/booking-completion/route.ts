import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;
  return (
    request.headers.get('authorization') === `Bearer ${expected}` ||
    request.headers.get('x-cron-secret') === expected
  );
}

async function GETHandler(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc(
      'process_automatic_booking_completion',
    );

    if (error) {
      console.error('[BOOKING_COMPLETION_CRON_ERROR]', error.code ?? 'UNKNOWN');
      return NextResponse.json(
        { ok: false, error: 'Booking completion worker failed.' },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        completed: Number(data ?? 0),
        finishedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[BOOKING_COMPLETION_CRON_EXCEPTION]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { ok: false, error: 'Booking completion worker failed.' },
      { status: 500 },
    );
  }
}

export const GET = withApiLogging('/api/cron/booking-completion', GETHandler);
