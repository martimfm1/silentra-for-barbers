import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set([
  'api', 'admin', 'login', 'registo', 'logout', 'plans', 'checkout',
  'dashboard', 'barbershops', 'marketplace', 'silentra-admin', 'legal',
  'privacy', 'terms', 'contact', 'contacto', 'about', 'sobre', 'pricing',
  'faq', 'auth', 'callback', 'reset-password', 'forgot-password',
  'unsubscribe', 'invite', 'join', 'billing', 'loyalty', 'documentation',
  'docs', 'status', 'support', 'register', 'signup', 'signin', 'sign-in',
  'sign-up', 'success', 'error', 'cancel', 'stripe', 'embed', 'health',
  'api-docs', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'manifest.webmanifest',
]);

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function getOwnerContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: fail('Tens de iniciar sessão.', 401) } as const;

  const tenant = await BarbershopStripeService.getTenantContext(user.id);
  const plan = await BarbershopStripeService.getEffectivePlan(user.id);
  const database = createAdminClient();
  if (plan === 'enterprise') {
    return {
      user, tenant, plan, database,
      access: { allowed: true, setupFee: 50, monthlyFee: 2.99, source: 'enterprise' as const },
    } as const;
  }

  const { data: grant, error: grantError } = await database
    .from('custom_website_access_grants')
    .select('plan_at_grant, setup_fee_eur, monthly_fee_eur')
    .eq('barbershop_id', tenant.barbershopId)
    .eq('active', true)
    .maybeSingle();
  if (grantError) {
    console.error('[CUSTOM_WEBSITE_ACCESS_CHECK_FAILED]', { code: grantError.code });
    return { response: fail('Não foi possível validar o acesso ao serviço de sites.', 503) } as const;
  }

  return {
    user, tenant, plan, database,
    access: grant ? {
      allowed: true,
      setupFee: Number(grant.setup_fee_eur),
      monthlyFee: Number(grant.monthly_fee_eur),
      source: 'admin_grant' as const,
    } : { allowed: false, setupFee: plan === 'pro' ? 150 : 150, monthlyFee: plan === 'pro' ? 4.99 : 6.99, source: 'not_granted' as const },
  } as const;
}

async function GET__unobserved() {
  try {
    const context = await getOwnerContext();
    if ('response' in context) return context.response;

    if (!context.access.allowed) {
      return NextResponse.json({
        data: [],
        access: context.access,
        plan: context.plan,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const { data, error } = await context.database
      .from('custom_website_requests')
      .select('id, shop_name, desired_slug, brief, contact_email, status, public_slug, site_title, site_description, hero_image_url, primary_cta_label, created_at, updated_at, published_at')
      .eq('barbershop_id', context.tenant.barbershopId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[CUSTOM_WEBSITE_REQUEST_LIST_FAILED]', { code: error.code });
      return fail('Não foi possível carregar os pedidos de site.', 503);
    }

    return NextResponse.json({ data: data ?? [], plan: context.plan, access: context.access }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[CUSTOM_WEBSITE_REQUEST_GET_FAILED]', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return fail('Não foi possível carregar os pedidos de site.', 500);
  }
}

async function POST__unobserved(request: Request) {
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
    const context = await getOwnerContext();
    if ('response' in context) return context.response;
    if (!context.access.allowed) {
      return fail('O acesso a sites personalizados ainda não foi autorizado para esta barbearia. Contacta a Silentra para adquirir o serviço.', 403);
    }

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > 12_000) {
      return fail('O pedido é demasiado grande.', 413);
    }
    const raw = await request.text();
    if (raw.length > 12_000) return fail('O pedido é demasiado grande.', 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return fail('JSON inválido.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail('Formato de pedido inválido.', 400);
    }

    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !['desiredSlug', 'brief'].includes(key))) {
      return fail('O pedido contém campos não permitidos.', 400);
    }
    const desiredSlug = typeof input.desiredSlug === 'string'
      ? input.desiredSlug.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : '';
    const brief = typeof input.brief === 'string' ? input.brief.trim() : '';

    if (desiredSlug.length < 3 || desiredSlug.length > 50 || !SLUG_PATTERN.test(desiredSlug) || RESERVED_SLUGS.has(desiredSlug)) {
      return fail('Escolhe um nome de URL válido, com 3 a 50 caracteres, sem nomes reservados.', 400);
    }
    if (brief.length < 20 || brief.length > 4000) {
      return fail('Descreve o site em pelo menos 20 caracteres (máximo 4000).', 400);
    }
    if (!context.user.email) return fail('A tua conta precisa de um email válido para contacto.', 400);

    const { data: shop, error: shopError } = await context.database
      .from('barbershops')
      .select('id, name, slug')
      .eq('id', context.tenant.barbershopId)
      .maybeSingle();
    if (shopError || !shop) {
      console.error('[CUSTOM_WEBSITE_SHOP_LOOKUP_FAILED]', { code: shopError?.code ?? 'NOT_FOUND' });
      return fail('Não foi possível identificar a tua barbearia.', 503);
    }
    if (!shop.slug) return fail('A barbearia precisa de um identificador público antes de pedir um site.', 409);

    const { data: active, error: activeError } = await context.database
      .from('custom_website_requests')
      .select('id, status')
      .eq('barbershop_id', context.tenant.barbershopId)
      .in('status', ['requested', 'contacted', 'in_progress', 'review'])
      .limit(1)
      .maybeSingle();
    if (activeError) {
      console.error('[CUSTOM_WEBSITE_ACTIVE_REQUEST_CHECK_FAILED]', { code: activeError.code });
      return fail('Não foi possível validar os pedidos existentes.', 503);
    }
    if (active) {
      return NextResponse.json({
        error: 'Já tens um pedido em aberto. Podes acompanhar o estado nesta página.',
        requestId: active.id,
      }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    const { data, error } = await context.database
      .from('custom_website_requests')
      .insert({
        barbershop_id: context.tenant.barbershopId,
        owner_user_id: context.user.id,
        shop_name: String(shop.name ?? 'Barbearia').slice(0, 160),
        booking_slug: String(shop.slug).slice(0, 100),
        contact_email: context.user.email.slice(0, 320),
        desired_slug: desiredSlug,
        brief,
        status: 'requested',
      })
      .select('id, shop_name, desired_slug, brief, contact_email, status, created_at')
      .single();

    if (error || !data) {
      if (error?.code === '23505') {
        return fail('Já existe um pedido de site em aberto para esta barbearia.', 409);
      }
      console.error('[CUSTOM_WEBSITE_REQUEST_CREATE_FAILED]', { code: error?.code ?? 'UNKNOWN' });
      return fail('Não foi possível registar o pedido. Tenta novamente.', 503);
    }

    return NextResponse.json({ data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[CUSTOM_WEBSITE_REQUEST_POST_FAILED]', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return fail('Não foi possível registar o pedido de site.', 500);
  }
}

export const GET = withApiObservability('/api/dashboard/custom-website', GET__unobserved);
export const POST = withApiObservability('/api/dashboard/custom-website', POST__unobserved);
