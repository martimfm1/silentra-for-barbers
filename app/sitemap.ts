import type { MetadataRoute } from 'next';
import { supabase, listRecords } from '@/lib/db';

const SITE_URL = 'https://barbers.silentra.me';

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
      lastModified: now,
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
  ];

  let dynamicShopRoutes: MetadataRoute.Sitemap = [];

  try {
    const { data: shops, error } = await listRecords<{
      id: string;
      slug?: string;
      public_profile_enabled?: boolean;
      updated_at?: string;
    }>(
      supabase,
      'shops',
      {},
      { select: 'id, slug, public_profile_enabled, updated_at' },
    );

    if (!error && shops) {
      const seen = new Set<string>();
      const shopEntries: ShopSitemapEntry[] = [];

      for (const shop of shops) {
        if (!shop.slug || shop.public_profile_enabled === false) continue;

        const slug = shop.slug.trim();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);

        const parsedLastModified = shop.updated_at
          ? new Date(shop.updated_at)
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

  return [...staticRoutes, ...dynamicShopRoutes];
}
