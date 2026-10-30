'use client';

import { usePathname } from 'next/navigation';
import { BarbershopProvider } from '@/context/BarbershopContext';
import { DashboardTopBar } from '@/app/dashboard/_components/DashboardTopBar';
import { DashboardSidebar } from '@/app/dashboard/_components/DashboardSidebar';
import { Spotlight } from '@/components/aceternity/spotlight';
import { DashboardTabMotionEnhancer } from '@/components/dashboard/dashboard-tab-motion-enhancer';
import { DashboardConfirmProvider } from '@/components/dashboard/dashboard-confirm-provider';
import { useLanguage } from '@/context/LanguageContext';
import { DashboardPageTransition } from '@/components/dashboard/dashboard-page-transition';

const dashboardSurfaceStyles = `
  .silentra-dashboard-shell .dashboard-page {
    position: relative;
    background: transparent;
  }

  /* Full-page route wrappers should never create a second opaque canvas. */
  .silentra-dashboard-shell .dashboard-page > main[class*="min-h-screen"],
  .silentra-dashboard-shell .dashboard-page > div[class*="min-h-screen"] {
    min-height: auto !important;
    background: transparent !important;
    background-image: none !important;
    border-color: transparent !important;
  }

  /* Keep dashboard surfaces airy and consistent with the platform backdrop. */
  .silentra-dashboard-shell .dashboard-page [data-slot="card"] {
    border-color: rgb(255 255 255 / 0.055) !important;
    background: linear-gradient(
      180deg,
      rgb(255 255 255 / 0.028),
      rgb(255 255 255 / 0.010)
    ) !important;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.025),
      0 18px 55px rgb(0 0 0 / 0.12) !important;
    backdrop-filter: blur(22px) saturate(125%);
    -webkit-backdrop-filter: blur(22px) saturate(125%);
  }

  .silentra-dashboard-shell .dashboard-page [data-slot="card"] [data-slot="card-header"] {
    border-color: rgb(255 255 255 / 0.04) !important;
  }

  /* Common hand-built dashboard panels. */
  .silentra-dashboard-shell .dashboard-page [class*="bg-zinc-950/"],
  .silentra-dashboard-shell .dashboard-page [class*="bg-black/"] {
    backdrop-filter: blur(20px) saturate(120%);
    -webkit-backdrop-filter: blur(20px) saturate(120%);
  }

  /* Avoid heavy framing; depth should come from translucency and shadow. */
  .silentra-dashboard-shell .dashboard-page [class*="border-white/10"] {
    border-color: rgb(255 255 255 / 0.055) !important;
  }

  @media (max-width: 1023px) {
    .silentra-dashboard-shell .dashboard-page {
      padding-bottom: calc(6.25rem + env(safe-area-inset-bottom));
    }
  }

  @media (min-width: 1024px) {
    .silentra-dashboard-shell .dashboard-page {
      padding-bottom: 7.5rem;
    }
  }
`;

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isSettingsPage = pathname.startsWith('/dashboard/settings');

  return (
    <div className="silentra-dashboard-shell">
      <style dangerouslySetInnerHTML={{ __html: dashboardSurfaceStyles }} />
      <a
        href="#dashboard-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        {t('common.skipToMain')}
      </a>
      <DashboardTabMotionEnhancer />
      {!isSettingsPage && <DashboardTopBar />}
      <DashboardSidebar />
      <div
        className={`dashboard-content silentra-dashboard-main min-w-0 ${
          isSettingsPage ? 'pt-0' : 'pt-16'
        }`}
      >
        <DashboardPageTransition>
          <main
            id="dashboard-main-content"
            tabIndex={-1}
            className="dashboard-page mx-auto max-w-[1600px] py-5 sm:py-7"
          >
            {children}
          </main>
        </DashboardPageTransition>
      </div>
    </div>
  );
}

export default function DashboardContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BarbershopProvider>
      <DashboardConfirmProvider>
        <Spotlight className="opacity-80" />
        <DashboardContent>{children}</DashboardContent>
      </DashboardConfirmProvider>
    </BarbershopProvider>
  );
}
