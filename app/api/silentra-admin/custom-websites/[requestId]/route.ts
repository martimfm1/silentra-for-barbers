import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/internal/platform-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set([
  'api', 'admin', 'login', 'registo', 'logout', 'plans', 'checkout',
  'dashboard', 'barbershops', 'marketplace', 'silentra-admin', 'legal',
  'privacy', 'terms', 'contact', 'contacto', 'about', 'sobre', 'pricing',
  'faq', 'auth', 'callback', 'reset-password', 'forgot-password',
  'unsubscribe', 'invite', 'join', 'billing', 'loyalty', 'robots.txt',
  'sitemap.xml', 'favicon.ico', 'manifest.webmanifest',
]);
const STATUSES = new Set(['requested', 'contacted', 'in_progress', 'review', 'published', 'rejected']);

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function PATCH__unobserved(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    try {
      const { assertSameOrigin } = await import('@/services/billing/http');
      assertSameOrigin(request);
    } catch {
      return fail('A origem do pedido não pôde ser validada.', 403);
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return fail('O pedido tem de usar application/json.', 415);
    }
    const { admin } = await requirePlatformAdmin();
    const { requestId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return fail('Identificador de pedido inválido.', 400);
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > 12_000) return fail('Pedido demasiado grande.', 413);
    const raw = await request.text();
    if (raw.length > 12_000) return fail('Pedido demasiado grande.', 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return fail('JSON inválido.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Formato inválido.', 400);
    const input = body as Record<string, unknown>;
    const allowed = new Set(['status', 'publicSlug', 'siteTitle', 'siteDescription', 'heroImageUrl', 'primaryCtaLabel', 'adminNotes']);
    if (Object.keys(input).some((key) => !allowed.has(key))) return fail('O pedido contém campos não permitidos.', 400);

    const update: Record<string, unknown> = {};
    if ('status' in input) {
      if (typeof input.status !== 'string' || !STATUSES.has(input.status)) return fail('Estado inválido.', 400);
      update.status = input.status;
    }
    if ('publicSlug' in input) {
      const slug = typeof input.publicSlug === 'string'
        ? input.publicSlug.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : '';
      if (slug && (slug.length < 3 || slug.length > 50 || !SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug))) {
        return fail('O caminho público tem de ser válido e não pode usar um nome reservado.', 400);
      }
      update.public_slug = slug || null;
    }
    const textFields = [
      ['siteTitle', 'site_title', 120],
      ['siteDescription', 'site_description', 500],
      ['primaryCtaLabel', 'primary_cta_label', 40],
      ['adminNotes', 'admin_notes', 2000],
    ] as const;
    for (const [inputKey, column, max] of textFields) {
      if (inputKey in input) {
        if (typeof input[inputKey] !== 'string') return fail(`Campo inválido: ${inputKey}.`, 400);
        update[column] = input[inputKey].trim().slice(0, max) || null;
      }
    }
    if ('heroImageUrl' in input) {
      const value = typeof input.heroImageUrl === 'string' ? input.heroImageUrl.trim() : '';
      if (value) {
        try {
          if (new URL(value).protocol !== 'https:') return fail('A imagem principal tem de usar HTTPS.', 400);
        } catch { return fail('URL da imagem inválido.', 400); }
      }
      update.hero_image_url = value || null;
    }
    if (Object.keys(update).length === 0) return fail('Não existem alterações para guardar.', 400);

    const { data: current, error: currentError } = await admin
      .from('custom_website_requests')
      .select('id, public_slug, site_title, site_description, status')
      .eq('id', requestId)
      .maybeSingle();
    if (currentError) {
      console.error('[ADMIN_CUSTOM_WEBSITE_READ_FAILED]', { code: currentError.code });
      return fail('Não foi possível validar o pedido.', 503);
    }
    if (!current) return fail('Pedido de site não encontrado.', 404);

    const nextStatus = (update.status ?? current.status) as string;
    const nextSlug = ('public_slug' in update ? update.public_slug : current.public_slug) as string | null;
    const nextTitle = ('site_title' in update ? update.site_title : current.site_title) as string | null;
    const nextDescription = ('site_description' in update ? update.site_description : current.site_description) as string | null;
    if (nextStatus === 'published' && (!nextSlug || !nextTitle || !nextDescription)) {
      return fail('Para publicar, define o caminho público, o título e a descrição do site.', 400);
    }
    if (nextSlug) {
      const { data: collision, error: collisionError } = await admin
        .from('custom_website_requests')
        .select('id')
        .eq('public_slug', nextSlug)
        .neq('id', requestId)
        .limit(1)
        .maybeSingle();
      if (collisionError) {
        console.error('[ADMIN_CUSTOM_WEBSITE_SLUG_CHECK_FAILED]', { code: collisionError.code });
        return fail('Não foi possível validar o caminho público.', 503);
      }
      if (collision) return fail('Esse caminho público já está atribuído a outro site.', 409);
    }

    const { data, error } = await admin
      .from('custom_website_requests')
      .update(update)
      .eq('id', requestId)
      .select('id, shop_name, desired_slug, contact_email, brief, status, public_slug, site_title, site_description, hero_image_url, primary_cta_label, admin_notes, created_at, updated_at, published_at')
      .single();
    if (error || !data) {
      console.error('[ADMIN_CUSTOM_WEBSITE_UPDATE_FAILED]', { code: error?.code ?? 'UNKNOWN' });
      return fail('Não foi possível guardar as alterações.', error?.code === '23505' ? 409 : 503);
    }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof Error && error.name === 'PlatformAdminError' ? 403 : 500;
    if (status === 500) console.error('[ADMIN_CUSTOM_WEBSITE_PATCH_FAILED]', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return fail(status === 403 ? 'Acesso reservado à administração.' : 'Erro ao atualizar o pedido.', status);
  }
}

export const PATCH = withApiObservability('/api/silentra-admin/custom-websites/[requestId]', PATCH__unobserved);
