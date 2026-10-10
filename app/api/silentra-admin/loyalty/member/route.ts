import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function GET__unobserved(request: Request) {
  try {
    const { admin } = await requirePlatformAdmin();
    const email =
      new URL(request.url).searchParams.get('email')?.trim().toLowerCase() ??
      '';
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }

    const { data, error } = await admin.rpc(
      'admin_find_loyalty_member_by_email',
      { p_email: email },
    );
    if (error) throw error;

    const member = Array.isArray(data) ? data[0] : data;
    return NextResponse.json(
      { member: member ?? null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'PlatformAdminError') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[SILENTRA_ADMIN_LOYALTY_LOOKUP]', error);
    return NextResponse.json(
      { error: 'Não foi possível pesquisar a fidelização.' },
      { status: 500 },
    );
  }
}

export const GET = withApiObservability('/api/silentra-admin/loyalty/member', GET__unobserved);
