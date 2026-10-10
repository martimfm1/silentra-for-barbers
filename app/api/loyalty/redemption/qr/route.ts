import { withApiLogging } from '@/lib/observability/api-request';
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashLoyaltyToken } from '@/lib/loyalty/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETHandler(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  if (!token || token.length < 32 || token.length > 256) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: redemption } = await admin
    .from('loyalty_redemptions')
    .select('id, token_hash, status, expires_at')
    .eq('token_hash', hashLoyaltyToken(token))
    .maybeSingle();

  if (
    !redemption ||
    redemption.status !== 'pending' ||
    !redemption.expires_at ||
    new Date(redemption.expires_at).getTime() <= Date.now()
  ) {
    return new NextResponse('Not found', { status: 404 });
  }

  const png = await QRCode.toBuffer(token, {
    type: 'png',
    width: 640,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'Content-Disposition': 'inline; filename="silentra-loyalty-qr.png"',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}


export const GET = withApiLogging('/api/loyalty/redemption/qr', GETHandler);
