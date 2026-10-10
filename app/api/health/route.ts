import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function GET__unobserved() {
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

export const GET = withApiObservability('/api/health', GET__unobserved);
