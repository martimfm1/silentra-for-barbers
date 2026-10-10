import { withApiObservability } from '@/lib/observability/api';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BarbershopStripeService } from '@/services/billing/barbershop-stripe.service';
import { planSupportsCustomSlug } from '@/lib/barbershops/public-profile';
import {
  validatePublicProfileSlug,
  normalizePublicProfileSlug,
} from '@/lib/barbershops/public-profile-slug';
import {
  DEFAULT_BARBERSHOP_AMENITIES,
  normalizeBarbershopAmenities,
} from '@/lib/barbershops/amenities';
import { BillingError } from '@/types/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function isValidHttpsUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function GET__unobserved() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return jsonError('Não autenticado.', 401);
    const tenant = await BarbershopStripeService.getTenantContext(user.id);
    const plan = await BarbershopStripeService.getEffectivePlan(user.id);
    const database = createAdminClient();
    const { data: shop, error: shopError } = await database
      .from('shops')
      .select(
        'id, slug, custom_slug, public_profile_enabled, seo_title, seo_description, og_image_url, theme_config, amenities',
      )
      .eq('barbershop_id', tenant.barbershopId)
      .maybeSingle();
    if (shopError)
      throw new BillingError(
        'Não foi possível carregar o perfil público.',
        'DB_READ_FAILED',
      );
    return NextResponse.json(
      {
        data: {
          ...shop,
          amenities: normalizeBarbershopAmenities(shop?.amenities),
          plan,
          canCustomizeSlug: planSupportsCustomSlug(plan),
          canCustomizeEnterprise: plan === 'enterprise',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof BillingError) return jsonError(error.message, 400);
    return jsonError('Não foi possível carregar o perfil público.', 500);
  }
}

async function PATCH__unobserved(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return jsonError('Não autenticado.', 401);
    const tenant = await BarbershopStripeService.getTenantContext(user.id);
    const plan = await BarbershopStripeService.getEffectivePlan(user.id);
    const canCustomizeSlug = planSupportsCustomSlug(plan);
    const canCustomizeEnterprise = plan === 'enterprise';

    const body = (await request.json().catch(() => ({}))) as {
      slug?: unknown;
      seoTitle?: unknown;
      seoDescription?: unknown;
      ogImageUrl?: unknown;
      themeConfig?: unknown;
      amenities?: unknown;
    };
    const database = createAdminClient();
    const { data: currentShop, error: currentError } = await database
      .from('shops')
      .select('id, slug, custom_slug, amenities')
      .eq('barbershop_id', tenant.barbershopId)
      .maybeSingle();
    if (currentError)
      throw new BillingError(
        'Não foi possível carregar a página pública.',
        'DB_READ_FAILED',
      );
    if (!currentShop)
      return jsonError(
        'A barbearia ainda não tem uma página pública configurada.',
        404,
      );

    const updates: Record<string, unknown> = {
      public_profile_updated_at: new Date().toISOString(),
    };

    if (typeof body.slug === 'string') {
      if (!canCustomizeSlug)
        return jsonError(
          'A personalização do URL público está disponível a partir do plano Pro.',
          403,
        );
      const slug = normalizePublicProfileSlug(body.slug);
      const validationError = validatePublicProfileSlug(slug);
      if (validationError) return jsonError(validationError, 400);
      const { data: conflictingShop } = await database
        .from('shops')
        .select('id')
        .or(`slug.eq.${slug},custom_slug.eq.${slug}`)
        .neq('id', currentShop.id)
        .maybeSingle();
      if (conflictingShop)
        return jsonError(
          'Este link já está a ser utilizado por outra barbearia.',
          409,
        );
      if (currentShop.slug && currentShop.slug !== slug) {
        const { error: redirectError } = await database
          .from('shop_slug_redirects')
          .upsert(
            { shop_id: currentShop.id, old_slug: currentShop.slug },
            { onConflict: 'shop_id,old_slug' },
          );
        if (redirectError)
          throw new BillingError(
            'Não foi possível preservar o URL antigo.',
            'DB_WRITE_FAILED',
          );
      }
      updates.slug = slug;
      updates.custom_slug = slug;
    }

    if (body.amenities !== undefined) {
      if (
        !body.amenities ||
        typeof body.amenities !== 'object' ||
        Array.isArray(body.amenities)
      )
        return jsonError('Informações do estabelecimento inválidas.', 400);
      updates.amenities = normalizeBarbershopAmenities({
        ...DEFAULT_BARBERSHOP_AMENITIES,
        ...(body.amenities as Record<string, unknown>),
      });
    }

    if (canCustomizeEnterprise) {
      if (body.seoTitle !== undefined)
        updates.seo_title = cleanText(body.seoTitle, 60);
      if (body.seoDescription !== undefined)
        updates.seo_description = cleanText(body.seoDescription, 160);
      if (body.ogImageUrl !== undefined) {
        const value = cleanText(body.ogImageUrl, 2048);
        if (value && !isValidHttpsUrl(value))
          return jsonError('A imagem OG tem de usar um URL HTTPS válido.', 400);
        updates.og_image_url = value;
      }
      if (body.themeConfig !== undefined) {
        if (
          !body.themeConfig ||
          typeof body.themeConfig !== 'object' ||
          Array.isArray(body.themeConfig)
        )
          return jsonError('Configuração visual inválida.', 400);
        if (JSON.stringify(body.themeConfig).length > 5000)
          return jsonError(
            'A configuração visual excede o limite permitido.',
            400,
          );
        updates.theme_config = body.themeConfig;
      }
    }

    const { data: updated, error: updateError } = await database
      .from('shops')
      .update(updates)
      .eq('id', currentShop.id)
      .eq('barbershop_id', tenant.barbershopId)
      .select(
        'id, slug, custom_slug, public_profile_enabled, seo_title, seo_description, og_image_url, theme_config, amenities',
      )
      .maybeSingle();
    if (updateError || !updated)
      throw new BillingError(
        'Não foi possível guardar a presença online.',
        'DB_WRITE_FAILED',
      );
    return NextResponse.json(
      {
        success: true,
        data: {
          ...updated,
          amenities: normalizeBarbershopAmenities(updated.amenities),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof BillingError) return jsonError(error.message, 400);
    return jsonError('Não foi possível atualizar a presença online.', 500);
  }
}

export const GET = withApiObservability('/api/barbershops/public-profile', GET__unobserved);
export const PATCH = withApiObservability('/api/barbershops/public-profile', PATCH__unobserved);
