import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { retryDueSupportEmailNotifications } from '@/services/support/support-chat.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return (
    request.headers.get('authorization') === `Bearer ${expected}` ||
    request.headers.get('x-cron-secret') === expected
  );
}

async function GET__unobserved(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await retryDueSupportEmailNotifications(admin);
    return NextResponse.json(
      { ok: true, ...result, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error(
      '[SUPPORT_EMAIL_RETRY_CRON_FAILED]',
      error instanceof Error ? error.name : 'UNKNOWN',
    );
    return NextResponse.json(
      { error: 'Não foi possível processar a fila de emails de suporte.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability(
  '/api/cron/support-email-notifications',
  GET__unobserved,
);
