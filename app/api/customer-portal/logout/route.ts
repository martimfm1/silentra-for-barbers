import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  clearPortalCookie,
  getPortalSession,
} from '@/lib/customer-booking-portal';
import { createAdminClient } from '@/lib/supabase/admin';

async function POST__unobserved(request: Request) {
  const session = await getPortalSession(request);
  if (session) {
    const admin = createAdminClient();
    const { error } = await admin
      .from('booking_portal_sessions')
      .delete()
      .eq('id', session.id);
    if (error) {
      console.error('[CUSTOMER_PORTAL_LOGOUT_ERROR]', error.code ?? 'UNKNOWN');
      return NextResponse.json(
        { success: false, error: 'Não foi possível terminar a sessão.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }
  await clearPortalCookie();
  return NextResponse.json(
    { success: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const POST = withApiObservability(
  '/api/customer-portal/logout',
  POST__unobserved,
);
