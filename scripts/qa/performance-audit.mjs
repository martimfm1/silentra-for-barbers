import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const read = (file) => readFile(join(process.cwd(), file), 'utf8');

const [
  nextConfig,
  layout,
  directoryCard,
  publicStorefront,
  marketplaceApi,
  pricesApi,
  observability,
] = await Promise.all([
  read('next.config.ts'),
  read('app/layout.tsx'),
  read('app/barbershops/components/shop-card.tsx'),
  read('app/barbershops/[slug]/public-barbershop-page-final.tsx'),
  read('app/api/marketplace/products/route.ts'),
  read('app/api/stripe/prices/route.ts'),
  read('lib/observability/api.ts'),
]);

assert.match(
  nextConfig,
  /formats:\s*\[\s*'image\/avif',\s*'image\/webp'\s*\]/,
  'Next Image should serve AVIF/WebP where supported.',
);
assert.doesNotMatch(
  layout,
  /const geistSans\s*=\s*Geist\(/,
  'The unused Geist Sans font should not be downloaded site-wide.',
);
assert.match(
  layout,
  /<Script id="whop-pixel" strategy="afterInteractive">/,
  'The Whop pixel must not compete with critical first paint resources.',
);
assert.doesNotMatch(
  directoryCard + publicStorefront,
  /\bunoptimized\b/,
  'Public shop images should use the Next Image optimizer.',
);

assert.match(
  marketplaceApi,
  /PUBLIC_CATALOG_CACHE\s*=\s*'public, max-age=0, s-maxage=15, stale-while-revalidate=45'/,
  'Public catalogue cache must be short-lived and stale-while-revalidate.',
);
assert.match(
  marketplaceApi,
  /Cache-Control': PUBLIC_CATALOG_CACHE/,
  'Successful public catalogue responses should use the CDN cache policy.',
);
assert.match(
  marketplaceApi,
  /featuredProductsPromise/,
  'The featured-product query should be started in parallel with the base query.',
);
assert.match(
  pricesApi,
  /s-maxage=60, stale-while-revalidate=120/,
  'Public plan prices should be cached at the CDN.',
);
assert.match(
  observability,
  /isSharedCacheableResponse/,
  'Observability must identify shared-cacheable responses.',
);
assert.match(
  observability,
  /!isSharedCacheableResponse\(response\)/,
  'Shared cache entries must not retain a per-request correlation ID.',
);

console.log(
  '[PERFORMANCE_QA] image optimization, deferred third-party pixel, public cache headers and parallel catalogue reads passed',
);
