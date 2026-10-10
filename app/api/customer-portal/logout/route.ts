import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import {
  clearPortalCookie,
  getPortalSession,
  hashPortalToken,
} from '@/lib/customer-booking-portal';
import { createAdminClient } from '@/lib/supabase/admin';

async function POST__unobserved() {
  const session = await getPortalSession();
  if (session) {
    const admin = createAdminClient();
    const cookieHeader = (await import('next/headers')).cookies;
    const store = await cookieHeader();
    const token = store.get('silentra_customer_portal')?.value;
    if (token)
      await admin
        .from('booking_portal_sessions')
        .delete()
        .eq('token_hash', hashPortalToken(token));
  }
  await clearPortalCookie();
  return NextResponse.json({ success: true });
}

export const POST = withApiObservability('/api/customer-portal/logout', POST__unobserved);
