import { NextResponse } from 'next/server';
import { withApiObservability } from '@/lib/observability/api';
import { dispatchMoneyFlowSyncBatch } from '@/services/integrations/moneyflow-sync.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-cron-secret') === secret
  );
}

async function GET__unobserved(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const requestId = crypto.randomUUID();
  const result = await dispatchMoneyFlowSyncBatch(50);
  console.info('[MONEYFLOW_SYNC_CRON]', { requestId, ...result });

  return NextResponse.json(
    { ok: true, requestId, ...result },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withApiObservability(
  '/api/cron/moneyflow-sync',
  GET__unobserved,
);
