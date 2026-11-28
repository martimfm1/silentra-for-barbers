import { withApiObservability } from '@/lib/observability/api';
import { hasValidCronSecret } from '@/lib/security/secret-comparison';
import { NextResponse } from 'next/server';
import { dispatchMoneyFlowOutboxBatch } from '@/services/moneyflow/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  return hasValidCronSecret(request, process.env.CRON_SECRET);
}

async function GET__unobserved(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const result = await dispatchMoneyFlowOutboxBatch(50);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[MONEYFLOW_SYNC_CRON_FAILED]', {
      error: error instanceof Error ? error.message : 'UNKNOWN',
    });
    return NextResponse.json(
      { ok: false, error: 'MoneyFlow sync failed.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/cron/moneyflow-sync',
  GET__unobserved,
);
