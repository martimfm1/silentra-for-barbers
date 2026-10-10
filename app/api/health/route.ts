import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function GETHandler() {
  return NextResponse.json(
    {
      ok: true,
      service: 'silentra-for-barbers',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}


export const GET = withApiLogging('/api/health', GETHandler);
