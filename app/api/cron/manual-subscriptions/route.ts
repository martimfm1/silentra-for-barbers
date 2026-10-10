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
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );

  const requestId = crypto.randomUUID();

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('expire_manual_subscriptions');

    if (error) {
      console.error('[MANUAL_SUBSCRIPTION_EXPIRY_ERROR]', {
        requestId,
        code: error.code ?? 'UNKNOWN',
      });
      return NextResponse.json(
        { ok: false, requestId, error: 'Manual subscription expiry failed.' },
        { status: 500 },
      );
    }

    const expired = Number(data ?? 0);
    console.info('[MANUAL_SUBSCRIPTION_EXPIRY]', { requestId, expired });

    return NextResponse.json(
      { ok: true, requestId, expired },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[MANUAL_SUBSCRIPTION_EXPIRY_EXCEPTION]', {
      requestId,
      error: error instanceof Error ? error.name : 'UNKNOWN',
    });
    return NextResponse.json(
      { ok: false, requestId, error: 'Manual subscription expiry failed.' },
      { status: 500 },
    );
  }
}


export const GET = withApiLogging('/api/cron/manual-subscriptions', GETHandler);
