import type { Metadata } from 'next';
import { GoogleTagManager } from '@next/third-parties/google';
import Script from 'next/script';
import { cookies } from 'next/headers';
import {
  Geist_Mono,
  Source_Sans_3,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';
import './silentra-responsive.css';
import { cn } from '@/lib/utils';
import { ClientShell } from '@/components/client-shell';
import { ProductionLogGuard } from '@/app/production-log-guard';
import { PwaRegistration } from '@/components/pwa-registration';
import { LanguageProvider } from '@/context/LanguageContext';
import { guestMetadata } from '@/lib/site-metadata';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import {
  COOKIE_CONSENT_COOKIE,
  parseCookieConsent,
} from '@/lib/privacy/cookie-consent';

const WHOP_PIXEL_SCRIPT = `!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_edgYPA5mT3GkKH");whop.track("page");`;

// Read the tracking capability and scrub the fragment before analytics/pixels
// execute. The fragment is not sent to the server, and after this bootstrap the
// canonical page URL contains no bearer token for GTM/Whop page-view events.
const TRACKING_TOKEN_BOOTSTRAP_SCRIPT = `(()=>{try{if(window.location.pathname==="/marketplace/track"){const params=new URLSearchParams(window.location.hash.slice(1));const token=params.get("token");if(token){let pendingToken=token;window.__SILENTRA_CONSUME_MARKETPLACE_TRACKING_TOKEN__=()=>{const value=pendingToken;pendingToken=null;return value}}window.history.replaceState(null,"",window.location.pathname+window.location.search);return}const url=new URL(window.location.href);const reviewToken=url.searchParams.get("review_token");if(reviewToken&&/^[A-Za-z0-9_-]{43}$/.test(reviewToken)){window.__SILENTRA_REVIEW_TOKEN__=reviewToken;url.searchParams.delete("review_token");window.history.replaceState(null,"",url.pathname+url.search+url.hash)}}catch{}})();`;

const jetbrainsMonoHeading = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-heading',
});
const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
});
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = guestMetadata;
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get('locale')?.value;
  const initialLocale = storedLocale === 'en' ? 'en' : 'pt';
  const enableVercelTelemetry = process.env.NODE_ENV === 'production';
  const cookieConsent = parseCookieConsent(
    cookieStore.get(COOKIE_CONSENT_COOKIE)?.value,
  );
  const allowAnalytics = cookieConsent?.analytics === true;
  const allowMarketing = cookieConsent?.marketing === true;
  // GTM can execute tags from multiple categories, so it loads only when the
  // visitor has explicitly enabled both analytics and marketing.

  return (
    <html
      lang={initialLocale === 'pt' ? 'pt-PT' : 'en'}
      dir="ltr"
      className={cn(
        'dark h-full scroll-smooth antialiased',
        geistMono.variable,
        'font-sans',
        sourceSans3.variable,
        jetbrainsMonoHeading.variable,
      )}
    >
      <head>
        <script
          id="marketplace-tracking-token-bootstrap"
          dangerouslySetInnerHTML={{ __html: TRACKING_TOKEN_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="min-h-full bg-black text-foreground">
        {allowAnalytics && allowMarketing ? (
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-PBCWTRT5"
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}
        {allowMarketing ? (
          <Script id="whop-pixel" strategy="afterInteractive">
            {WHOP_PIXEL_SCRIPT}
          </Script>
        ) : null}
        {allowAnalytics && allowMarketing ? (
          <GoogleTagManager gtmId="GTM-PBCWTRT5" />
        ) : null}
        <LanguageProvider initialLocale={initialLocale}>
          <ProductionLogGuard />
          <PwaRegistration />
          {enableVercelTelemetry && allowAnalytics ? <SpeedInsights /> : null}
          {enableVercelTelemetry && allowAnalytics ? <Analytics /> : null}
          <ClientShell>{children}</ClientShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
