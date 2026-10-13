import type { Metadata } from 'next';
import { GoogleTagManager } from '@next/third-parties/google';
import { cookies } from 'next/headers';
import {
  Geist,
  Geist_Mono,
  Source_Sans_3,
  JetBrains_Mono,
} from 'next/font/google';
import './globals.css';
import './silentra-responsive.css';
import { cn } from '@/lib/utils';
import { ClientShell } from '@/components/client-shell';
import { ProductionLogGuard } from '@/app/production-log-guard';
import { LanguageProvider } from '@/context/LanguageContext';
import { guestMetadata } from '@/lib/site-metadata';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const WHOP_PIXEL_SCRIPT = `!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_edgYPA5mT3GkKH");whop.track("page");`;

// Read the tracking capability and scrub the fragment before analytics/pixels
// execute. The fragment is not sent to the server, and after this bootstrap the
// canonical page URL contains no bearer token for GTM/Whop page-view events.
const TRACKING_TOKEN_BOOTSTRAP_SCRIPT = `(()=>{try{if(window.location.pathname!=="/marketplace/track")return;const params=new URLSearchParams(window.location.hash.slice(1));const token=params.get("token");if(token)window.__SILENTRA_MARKETPLACE_TRACKING_TOKEN__=token;window.history.replaceState(null,"",window.location.pathname+window.location.search)}catch{window.history.replaceState(null,"",window.location.pathname+window.location.search)}})();`;

const jetbrainsMonoHeading = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-heading',
});
const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
});
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = guestMetadata;
export const viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get('locale')?.value;
  const initialLocale = storedLocale === 'en' ? 'en' : 'pt';
  const enableVercelTelemetry = process.env.NODE_ENV === 'production';

  return (
    <html
      lang={initialLocale === 'pt' ? 'pt-PT' : 'en'}
      dir="ltr"
      className={cn(
        'dark h-full scroll-smooth antialiased',
        geistSans.variable,
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
        <script
          id="whop-pixel"
          dangerouslySetInnerHTML={{ __html: WHOP_PIXEL_SCRIPT }}
        />
      </head>
      <body className="min-h-full bg-black text-foreground">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PBCWTRT5"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <GoogleTagManager gtmId="GTM-PBCWTRT5" />
        <LanguageProvider initialLocale={initialLocale}>
          <ProductionLogGuard />
          {enableVercelTelemetry ? <SpeedInsights /> : null}
          {enableVercelTelemetry ? <Analytics /> : null}
          <ClientShell>{children}</ClientShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
