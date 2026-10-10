import { withApiLogging } from '@/lib/observability/api-request';
import { NextRequest } from 'next/server';
import { handleBrevoWebhook } from '@/lib/marketing/brevo-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function POSTHandler(request: NextRequest) {
  return handleBrevoWebhook(request);
}


export const POST = withApiLogging('/api/webhooks/brevo', POSTHandler);
