import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { requireTenantAuthorization } from '@/services/modules/tenant-authorization';
import { readJsonObject } from '@/lib/security/request-validation';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { planSupportsCustomSlug } from '@/lib/barbershops/public-profile';
import {
  normalizePublicProfileSlug,
  validatePublicProfileSlug,
} from '@/lib/barbershops/public-profile-slug';

const QR_MANAGE_ROLES = ['owner', 'admin'] as const;
const DEFAULT_QR_TEXT =
  'Scaneia para conhecer a nossa barbearia e marcar o teu proximo servico.';

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function GET__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, QR_MANAGE_ROLES);
  if (!tenant.ok)
    return jsonError(
      tenant.status === 401 ? 'Nao autenticado.' : 'Sem permissao.',
      tenant.status,
    );

  try {
    const [barbershopResult, shopResult, plan] = await Promise.all([
      tenant.admin
        .from('barbershops')
        .select('name, qr_code_text')
        .eq('id', tenant.barbershopId)
        .maybeSingle(),
      tenant.admin
        .from('shops')
        .select('slug, custom_slug')
        .eq('barbershop_id', tenant.barbershopId)
        .eq('is_active', true)
        .maybeSingle(),
      BarbershopStripeService.getEffectivePlan(tenant.userId),
    ]);

    if (barbershopResult.error || shopResult.error)
      return jsonError('Nao foi possivel carregar o codigo QR.', 500);
    if (!shopResult.data?.slug)
      return jsonError('Nao foi possivel preparar o codigo QR.', 404);

    const canCustomize = planSupportsCustomSlug(plan);
    return NextResponse.json(
      {
        slug: canCustomize
          ? shopResult.data.custom_slug || shopResult.data.slug
          : shopResult.data.slug,
        name: barbershopResult.data?.name || 'Barbearia',
        text: barbershopResult.data?.qr_code_text || DEFAULT_QR_TEXT,
        plan,
        canCustomize,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[BARBERSHOP_QR_CODE_LOAD]', error);
    return jsonError('Nao foi possivel carregar o codigo QR.', 500);
  }
}

async function PATCH__unobserved(request: Request) {
  const tenant = await requireTenantAuthorization(request, QR_MANAGE_ROLES);
  if (!tenant.ok)
    return jsonError(
      tenant.status === 401 ? 'Nao autenticado.' : 'Sem permissao.',
      tenant.status,
    );

  const bodyResult = await readJsonObject(request, {
    maxBytes: 3 * 1024,
    allowedKeys: ['slug', 'text'],
  });
  if (!bodyResult.ok) return bodyResult.response;

  const body = bodyResult.value;
  if (typeof body.slug !== 'string')
    return jsonError('O URL público é inválido.', 400);
  if (typeof body.text !== 'string')
    return jsonError('A legenda do código QR é inválida.', 400);

  const slug = normalizePublicProfileSlug(body.slug);
  const slugError = validatePublicProfileSlug(slug);
  if (slugError) return jsonError(slugError, 400);

  const text = body.text.trim();
  if (text.length > 160)
    return jsonError(
      'A legenda pode ter no máximo 160 caracteres.',
      400,
    );

  try {
    const plan = await BarbershopStripeService.getEffectivePlan(tenant.userId);
    if (!planSupportsCustomSlug(plan))
      return jsonError(
        'A personalização do URL e da legenda do QR code está disponível nos planos Pro e Enterprise.',
        403,
      );

    const { data: currentShop, error: shopError } = await tenant.admin
      .from('shops')
      .select('id, slug')
      .eq('barbershop_id', tenant.barbershopId)
      .eq('is_active', true)
      .maybeSingle();

    if (shopError)
      return jsonError('Nao foi possivel carregar a pagina publica.', 500);
    if (!currentShop)
      return jsonError('A barbearia ainda nao tem uma pagina publica.', 404);

    const { data: conflictingShop, error: conflictError } = await tenant.admin
      .from('shops')
      .select('id')
      .or(`slug.eq.${slug},custom_slug.eq.${slug}`)
      .neq('id', currentShop.id)
      .maybeSingle();

    if (conflictError)
      return jsonError('Nao foi possivel validar o URL publico.', 500);
    if (conflictingShop)
      return jsonError(
        'Este link ja esta a ser utilizado por outra barbearia.',
        409,
      );

    if (currentShop.slug && currentShop.slug !== slug) {
      const { error: redirectError } = await tenant.admin
        .from('shop_slug_redirects')
        .upsert(
          { shop_id: currentShop.id, old_slug: currentShop.slug },
          { onConflict: 'shop_id,old_slug' },
        );
      if (redirectError)
        return jsonError('Nao foi possivel preservar o URL antigo.', 500);
    }

    const [{ error: shopUpdateError }, { error: textUpdateError }] =
      await Promise.all([
        tenant.admin
          .from('shops')
          .update({ slug, custom_slug: slug })
          .eq('id', currentShop.id)
          .eq('barbershop_id', tenant.barbershopId),
        tenant.admin
          .from('barbershops')
          .update({ qr_code_text: text || null })
          .eq('id', tenant.barbershopId),
      ]);

    if (shopUpdateError || textUpdateError) {
      console.error('[BARBERSHOP_QR_CODE_SAVE]', {
        shop: shopUpdateError?.code ?? null,
        text: textUpdateError?.code ?? null,
      });
      return jsonError('Nao foi possivel guardar as definicoes do QR code.', 500);
    }

    return NextResponse.json(
      {
        slug,
        text: text || DEFAULT_QR_TEXT,
        canCustomize: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[BARBERSHOP_QR_CODE_SAVE]', error);
    return jsonError('Nao foi possivel guardar as definicoes do QR code.', 500);
  }
}

export const GET = withApiObservability(
  '/api/barbershops/qr-code',
  GET__unobserved,
);
export const PATCH = withApiObservability(
  '/api/barbershops/qr-code',
  PATCH__unobserved,
);
