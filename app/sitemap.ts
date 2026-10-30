import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicProfileById } from '@/lib/barbershops/public-profile';

const SITE_URL = 'https://barbers.silentra.me';
const AGENDA_DO_VICTOR_SHOP_SLUG = 'silveira-salon-6f1e9637';

// Refresh database-backed public profile URLs hourly without querying on every crawler request.
export const revalidate = 3600;

type ShopSitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: 'weekly';
  priority: number;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/barbershops`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/plans`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/software-gestao-barbearia`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/documentation`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/cookies`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.2,
    },
  ];

  let dynamicShopRoutes: MetadataRoute.Sitemap = [];

  try {
    const database = createAdminClient();
    const { data: shops, error } = await database
      .from('shops')
      .select('slug, public_profile_enabled, updated_at')
      .limit(50000);

    if (!error && shops) {
      const seen = new Set<string>();
      const shopEntries: ShopSitemapEntry[] = [];

      for (const shop of shops) {
        if (!shop.slug || shop.public_profile_enabled === false) continue;

        const slug = String(shop.slug).trim();
        if (!slug || seen.has(slug) || slug === AGENDA_DO_VICTOR_SHOP_SLUG) continue;
        seen.add(slug);

        const parsedLastModified = shop.updated_at
          ? new Date(String(shop.updated_at))
          : now;

        shopEntries.push({
          url: `${SITE_URL}/barbershops/${encodeURIComponent(slug)}`,
          lastModified: Number.isNaN(parsedLastModified.getTime())
            ? now
            : parsedLastModified,
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }

      dynamicShopRoutes = shopEntries;
    }
  } catch {
    // Sitemap generation should remain best-effort; private application routes are excluded.
  }

  const enterpriseLandingRoutes: MetadataRoute.Sitemap = [];

  try {
    const database = createAdminClient();
    const { data: activeLandingPages, error: landingPagesError } =
      await database
        .from('barbershop_landing_pages')
        .select('barbershop_id, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1000);

    if (!landingPagesError && activeLandingPages?.length) {
      // Resolve a small batch at a time to avoid thousands of concurrent queries.
      for (let offset = 0; offset < activeLandingPages.length; offset += 20) {
        const batch = await Promise.all(
          activeLandingPages.slice(offset, offset + 20).map(async (entry) => {
            try {
              const profile = await getPublicProfileById(
                String(entry.barbershop_id),
              );
              if (
                !profile ||
                profile.plan !== 'enterprise' ||
                profile.public_profile_enabled === false
              ) {
                return null;
              }

              const parsedLastModified = entry.updated_at
                ? new Date(entry.updated_at)
                : now;

              return {
                url: `${SITE_URL}/site/${encodeURIComponent(profile.slug)}`,
                lastModified: Number.isNaN(parsedLastModified.getTime())
                  ? now
                  : parsedLastModified,
                changeFrequency: 'weekly' as const,
                priority: 0.75,
              };
            } catch {
              return null;
            }
          }),
        );

        for (const entry of batch) {
          if (entry) enterpriseLandingRoutes.push(entry);
        }
      }
    }
  } catch {
    // Enterprise URLs are best-effort if the entitlement migration is not deployed yet.
  }

  const customWebsiteRoutes: MetadataRoute.Sitemap = [];

  try {
    const database = createAdminClient();
    const { data: websites, error: websitesError } = await database
      .from('custom_website_requests')
      .select('public_slug, published_at, updated_at')
      .eq('status', 'published')
      .not('public_slug', 'is', null)
      .order('published_at', { ascending: false })
      .limit(5000);

    if (!websitesError && websites?.length) {
      const seen = new Set<string>();
      for (const website of websites) {
        const slug = String(website.public_slug ?? '').trim().toLowerCase();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        const lastModifiedValue = website.published_at ?? website.updated_at;
        const parsedLastModified = lastModifiedValue
          ? new Date(String(lastModifiedValue))
          : now;
        customWebsiteRoutes.push({
          url: `${SITE_URL}/${encodeURIComponent(slug)}`,
          lastModified: Number.isNaN(parsedLastModified.getTime())
            ? now
            : parsedLastModified,
          changeFrequency: 'weekly',
          priority: 0.85,
        });
      }
    }
  } catch {
    // Custom website URLs are best-effort when the feature table is unavailable.
  }

  return [
    ...staticRoutes,
    ...dynamicShopRoutes,
    {
      url: `${SITE_URL}/agendadovictor`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...enterpriseLandingRoutes,
    ...customWebsiteRoutes,
  ];
}
