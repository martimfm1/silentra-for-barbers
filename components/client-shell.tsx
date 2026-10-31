'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/providers/query-provider';
import { CookieConsentManager } from '@/components/privacy/cookie-consent-manager';

const dashboardRoutePrefixes = [
  '/dashboard',
  '/silentra-admin',
  '/_silentra-admin',
  '/silentra_admin',
] as const;

function isDashboardRoute(pathname: string | null) {
  return Boolean(
    pathname &&
    dashboardRoutePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showCookieConsent = !isDashboardRoute(pathname);

  return (
    <div className="min-h-screen text-zinc-50">
      <QueryProvider>{children}</QueryProvider>
      <Toaster richColors position="top-right" />
      {showCookieConsent ? <CookieConsentManager /> : null}
    </div>
  );
}
