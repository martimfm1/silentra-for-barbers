import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  processQueuedCampaignRecipients,
  processScheduledCampaigns,
} from '@/lib/marketing/dispatcher';
import { processBirthdayCampaignDelivery } from '@/lib/marketing/birthday-delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
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
      { status: 401 },
    );
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const birthdays = await processBirthdayCampaignDelivery(25);
    const scheduled = await processScheduledCampaigns(25);
    const delivery = await processQueuedCampaignRecipients(100);
    const result = {
      ok: true,
      requestId,
      birthdayCampaignsProcessed: birthdays.campaignsProcessed,
      birthdayRecipientsProcessed: birthdays.recipientsProcessed,
      birthdaySent: birthdays.sent,
      birthdayFailed: birthdays.failed,
      birthdayVouchersIssued: birthdays.vouchersIssued,
      scheduledCampaigns: scheduled.processed,
      queuedRecipientsProcessed: delivery.processed,
      sent: delivery.sent,
      failed: delivery.failed,
      durationMs: Date.now() - startedAt,
    };
    console.info('[MARKETING_CRON] completed', result);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[MARKETING_CRON] failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        requestId,
        error: 'Marketing worker failed',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/cron/marketing', GET__unobserved);
