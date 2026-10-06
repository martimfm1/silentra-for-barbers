import type { Metadata } from 'next';
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
import Script from 'next/script';

const WHOP_PIXEL_SCRIPT = "!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x===\"string\"});a.q.push([+new Date,\"setScope\"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+\"/s.js\";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,\"script\",\"https://t.whop.tw\",\"whop\");whop.setScope(\"biz_edgYPA5mT3GkKH\");whop.track(\"page\");";

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
        <Script id="google-tag-manager" strategy="beforeInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PBCWTRT5');`}</Script>
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
