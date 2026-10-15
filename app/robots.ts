import { MetadataRoute } from 'next';

const SITE_URL = 'https://barbers.silentra.me';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep pages with noindex directives crawlable so search engines can read them.
      // API responses are not search content; robots.txt is not an access-control mechanism.
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
