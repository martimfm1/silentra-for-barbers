import { createHmac, timingSafeEqual } from 'node:crypto';
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
  const cronSecret = process.env.CRON_SECRET?.trim();
  const secret = (
    process.env.BOOKING_OUTBOX_CRON_SECRET ?? cronSecret
  )?.trim();
  if (!secret) return false;

  // Keep the original CRON_SECRET path for manual and GitHub Actions calls.
  if (
    (cronSecret &&
      request.headers.get('authorization') === `Bearer ${cronSecret}`) ||
    (cronSecret && request.headers.get('x-cron-secret') === cronSecret)
  )
    return true;

  // Supabase Cron signs requests with the existing Vault secret.
  if (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-cron-secret') === secret
  )
    return true;

  const timestamp = request.headers.get('x-marketing-timestamp') ?? '';
  const signature = request.headers.get('x-marketing-signature') ?? '';
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature))
    return false;

  const seconds = Number(timestamp);
  if (
    !Number.isSafeInteger(seconds) ||
    Math.abs(Date.now() / 1000 - seconds) > 300
  )
    return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}:marketing`)
    .digest();
  const supplied = Buffer.from(signature, 'hex');
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
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
export const POST = withApiObservability('/api/cron/marketing', GET__unobserved);
