import type { BillingPlan } from '@/types/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/validation';

const PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidPublicProfileSlug(value: string): boolean {
  return (
    value.length >= 3 && value.length <= 60 && PUBLIC_SLUG_PATTERN.test(value)
  );
}

export function planSupportsCustomSlug(plan: BillingPlan): boolean {
  return plan === 'pro' || plan === 'enterprise';
}

export function planSupportsEnterpriseCustomization(
  plan: BillingPlan,
): boolean {
  return plan === 'enterprise';
}

export interface PublicProfileRecord {
  id: string;
  slug: string;
  custom_slug: string | null;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  tags: string[];
  barbershop_id: string | null;
  public_profile_enabled: boolean;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  theme_config: Record<string, unknown>;
  plan: BillingPlan;
  owner_user_id?: string | null;
  landing_page_url?: string | null;
}

type BarbershopRecord = {
  id: string;
  name: string;
  slug: string | null;
  phone: string | null;
  address: string | null;
  opening_time: string | null;
  closing_time: string | null;
  is_public_in_directory: boolean | null;
  created_by: string | null;
};

type ShopRecord = {
  id: string;
  barbershop_id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  tags: string[] | null;
  slug: string | null;
  custom_slug?: string | null;
  public_profile_enabled?: boolean | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_url?: string | null;
  theme_config?: unknown;
};

async function getBarbershopByColumn(
  column: 'id' | 'slug',
  value: string,
): Promise<BarbershopRecord | null> {
  const database = createAdminClient();
  const { data, error } = await database
    .from('barbershops')
    .select(
      'id, name, slug, phone, address, opening_time, closing_time, is_public_in_directory, created_by',
    )
    .eq(column, value)
    .maybeSingle();

  if (error) {
    console.error('[PUBLIC_PROFILE_DB_ERROR]', {
      operation: 'barbershop_lookup',
      column,
      code: error.code ?? 'UNKNOWN',
    });
    return null;
  }

  return data as BarbershopRecord | null;
}

async function getShopByBarbershopId(
  barbershopId: string,
): Promise<ShopRecord | null> {
  const database = createAdminClient();
  const { data, error } = await database
    .from('shops')
    .select('*')
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  if (error) {
    console.error('[PUBLIC_PROFILE_DB_ERROR]', {
      operation: 'shop_enrichment',
      code: error.code ?? 'UNKNOWN',
    });
    return null;
  }

  return (data as ShopRecord | null) ?? null;
}

async function getBarbershopByShopSlug(
  slug: string,
): Promise<BarbershopRecord | null> {
  const database = createAdminClient();
  const { data: shop, error } = await database
    .from('shops')
    .select('barbershop_id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[PUBLIC_PROFILE_DB_ERROR]', {
      operation: 'shop_slug_lookup',
      code: error.code ?? 'UNKNOWN',
    });
    return null;
  }

  if (!shop?.barbershop_id) return null;
  return getBarbershopByColumn('id', String(shop.barbershop_id));
}

async function getBarbershopByCustomSlug(
  slug: string,
): Promise<BarbershopRecord | null> {
  const database = createAdminClient();
  const { data: shop, error } = await database
    .from('shops')
    .select('barbershop_id')
    .eq('custom_slug', slug)
    .maybeSingle();

  if (error) {
    if (error.code !== '42703') {
      console.error('[PUBLIC_PROFILE_DB_ERROR]', {
        operation: 'custom_slug_lookup',
        code: error.code ?? 'UNKNOWN',
      });
    }
    return null;
  }

  if (!shop?.barbershop_id) return null;
  return getBarbershopByColumn('id', String(shop.barbershop_id));
}

async function getPlanForShop(
  barbershopId: string | null,
): Promise<{ plan: BillingPlan; ownerUserId: string | null }> {
  if (!barbershopId) return { plan: 'free', ownerUserId: null };

  const database = createAdminClient();
  const [
    { data: barbershop, error: barbershopError },
    { data: assignment, error: assignmentError },
    { data: subscription, error: subscriptionError },
  ] = await Promise.all([
    database
      .from('barbershops')
      .select('id, created_by')
      .eq('id', barbershopId)
      .maybeSingle(),
    database
      .from('barbershop_plan_assignments')
      .select('plan, expires_at')
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
    database
      .from('subscriptions')
      .select('plan, plan_override, status')
      .eq('barbershop_id', barbershopId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (barbershopError || assignmentError || subscriptionError) {
    console.error('[PUBLIC_PROFILE_PLAN_LOOKUP_ERROR]', {
      barbershop: barbershopError?.code ?? null,
      assignment: assignmentError?.code ?? null,
      subscription: subscriptionError?.code ?? null,
    });
  }

  const ownerUserId = barbershop?.created_by ?? null;
  if (
    assignment &&
    (!assignment.expires_at ||
      new Date(assignment.expires_at).getTime() > Date.now())
  ) {
    return { plan: assignment.plan as BillingPlan, ownerUserId };
  }

  const subscriptionPlan =
    subscription?.plan_override && subscription.plan_override !== 'free'
      ? subscription.plan_override
      : subscription?.plan;
  const paidStatus = ['active', 'trialing'].includes(
    String(subscription?.status ?? ''),
  );
  if (
    paidStatus &&
    (subscriptionPlan === 'pro' || subscriptionPlan === 'enterprise')
  ) {
    return { plan: subscriptionPlan as BillingPlan, ownerUserId };
  }

  return { plan: 'free', ownerUserId };
}

function buildPublicProfile(
  barbershop: BarbershopRecord,
  shop: ShopRecord | null,
  plan: BillingPlan,
  ownerUserId: string | null,
): PublicProfileRecord {
  const customSlug =
    typeof shop?.custom_slug === 'string'
      ? shop.custom_slug.trim().toLowerCase()
      : null;
  const baseSlug =
    barbershop.slug?.trim().toLowerCase() ||
    shop?.slug?.trim().toLowerCase() ||
    '';
  const effectiveSlug =
    planSupportsCustomSlug(plan) && customSlug ? customSlug : baseSlug;
  const themeConfig =
    planSupportsEnterpriseCustomization(plan) &&
    shop?.theme_config &&
    typeof shop.theme_config === 'object' &&
    !Array.isArray(shop.theme_config)
      ? (shop.theme_config as Record<string, unknown>)
      : {};

  return {
    id: shop?.id ?? barbershop.id,
    slug: effectiveSlug,
    custom_slug: customSlug,
    name: shop?.name?.trim() || barbershop.name,
    city: shop?.city ?? null,
    address: shop?.address ?? barbershop.address ?? null,
    phone: shop?.phone ?? barbershop.phone ?? null,
    avatar_url: shop?.avatar_url ?? null,
    cover_url: shop?.cover_url ?? null,
    tags: Array.isArray(shop?.tags) ? shop.tags : [],
    barbershop_id: barbershop.id,
    public_profile_enabled:
      shop?.public_profile_enabled !== false &&
      barbershop.is_public_in_directory !== false,
    seo_title: planSupportsEnterpriseCustomization(plan)
      ? (shop?.seo_title ?? null)
      : null,
    seo_description: planSupportsEnterpriseCustomization(plan)
      ? (shop?.seo_description ?? null)
      : null,
    og_image_url: planSupportsEnterpriseCustomization(plan)
      ? (shop?.og_image_url ?? null)
      : null,
    theme_config: themeConfig,
    plan,
    owner_user_id: ownerUserId ?? barbershop.created_by ?? null,
  };
}

async function resolvePublicBarbershop(
  barbershop: BarbershopRecord | null,
): Promise<PublicProfileRecord | null> {
  if (!barbershop || barbershop.is_public_in_directory === false) return null;

  const shop = await getShopByBarbershopId(barbershop.id);
  const { plan, ownerUserId } = await getPlanForShop(barbershop.id);
  const profile = buildPublicProfile(barbershop, shop, plan, ownerUserId);

  if (!isValidPublicProfileSlug(profile.slug)) return null;
  if (profile.public_profile_enabled === false) return null;

  return profile;
}

export async function getPublicProfileById(
  id: string,
): Promise<PublicProfileRecord | null> {
  const normalized = id.trim();
  if (!UUID_PATTERN.test(normalized)) return null;
  return resolvePublicBarbershop(await getBarbershopByColumn('id', normalized));
}

export async function getPublicProfileBySlug(
  slug: string,
): Promise<PublicProfileRecord | null> {
  const normalized = slug.trim().toLowerCase();
  if (!isValidPublicProfileSlug(normalized)) return null;

  const byBaseSlug = await getBarbershopByColumn('slug', normalized);
  if (byBaseSlug) return resolvePublicBarbershop(byBaseSlug);

  const byShopSlug = await getBarbershopByShopSlug(normalized);
  if (byShopSlug) return resolvePublicBarbershop(byShopSlug);

  const byCustomSlug = await getBarbershopByCustomSlug(normalized);
  if (byCustomSlug) return resolvePublicBarbershop(byCustomSlug);

  return null;
}

export async function getPublicProfileByRedirect(
  oldSlug: string,
): Promise<PublicProfileRecord | null> {
  const normalized = oldSlug.trim().toLowerCase();
  if (!normalized) return null;

  const database = createAdminClient();
  const { data: redirect, error } = await database
    .from('shop_slug_redirects')
    .select('shop_id')
    .eq('old_slug', normalized)
    .maybeSingle();

  if (error) {
    console.error('[PUBLIC_PROFILE_REDIRECT_ERROR]', {
      code: error.code ?? 'UNKNOWN',
    });
    return null;
  }

  if (!redirect?.shop_id) return null;
  return getPublicProfileById(String(redirect.shop_id));
}
