type WebpackConfig = {
  module?: {
    exprContextCritical?: boolean;
  };
};

/**
 * Public pages are intentionally embeddable by default.
 *
 * Sensitive/authenticated areas explicitly opt out of framing below with
 * both CSP frame-ancestors and X-Frame-Options for legacy browser coverage.
 */
const noFrameHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none';",
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.56.1', 'localhost:3000', '192.168.1.6'],
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', '@tabler/icons-react', 'date-fns'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async rewrites() {
    return [
      // Next.js treats app folders starting with '_' as private folders and
      // excludes them from the route tree. Keep the intentionally obscure
      // public URL while routing internally to normal route segments.
      {
        source: '/_silentra-admin',
        destination: '/silentra-admin',
      },
      {
        source: '/_silentra-admin/:path*',
        destination: '/silentra-admin/:path*',
      },
      {
        source: '/api/_silentra-admin/:path*',
        destination: '/api/silentra-admin/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/login/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/forgot-password/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/reset-password/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/registo/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/confirm-email/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/email-confirmed/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/email-confirmation-error/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/my-bookings/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/onboarding/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/checkout/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/mensagens/:path*',
        headers: [...noFrameHeaders],
      },
      {
        source: '/silentra-admin/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/_silentra-admin/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/api/silentra-admin/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet',
          },
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          ...noFrameHeaders,
        ],
      },
      {
        source: '/api/_silentra-admin/:path*',
        headers: [...noFrameHeaders],
      },
      {
        source: '/api/:path*',
        headers: [...noFrameHeaders],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  webpack: (config: WebpackConfig, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      config.module ??= {};
      config.module.exprContextCritical = false;
    }
    return config;
  },
};

export default nextConfig;
