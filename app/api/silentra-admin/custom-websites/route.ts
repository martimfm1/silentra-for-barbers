import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function GET__unobserved() {
  try {
    const { admin } = await requirePlatformAdmin();
    const { data, error } = await admin
      .from('custom_website_requests')
      .select('id, barbershop_id, owner_user_id, shop_name, booking_slug, contact_email, desired_slug, brief, status, public_slug, site_title, site_description, hero_image_url, primary_cta_label, admin_notes, created_at, updated_at, published_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[ADMIN_CUSTOM_WEBSITES_LIST_FAILED]', { code: error.code });
      return fail('Não foi possível carregar os pedidos de sites.', 503);
    }

    return NextResponse.json({ data: data ?? [] }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const status = error instanceof Error && error.name === 'PlatformAdminError' ? 403 : 500;
    if (status === 500) console.error('[ADMIN_CUSTOM_WEBSITES_GET_FAILED]', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return fail(status === 403 ? 'Acesso reservado à administração.' : 'Erro ao carregar os pedidos.', status);
  }
}

export const GET = withApiObservability('/api/silentra-admin/custom-websites', GET__unobserved);
