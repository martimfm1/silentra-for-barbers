import { withApiObservability } from '@/lib/observability/api';
import { NextRequest } from 'next/server';
import { handleBrevoWebhook } from '@/lib/marketing/brevo-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function POST__unobserved(request: NextRequest) {
  return handleBrevoWebhook(request);
}

export const POST = withApiObservability('/api/webhooks/brevo', POST__unobserved);
