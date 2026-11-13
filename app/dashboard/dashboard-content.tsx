'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { BarbershopProvider } from '@/context/BarbershopContext';
import { DashboardTopBar } from '@/app/dashboard/_components/DashboardTopBar';
import { DashboardSidebar } from '@/app/dashboard/_components/DashboardSidebar';
import { DashboardCreateBookingDialog } from '@/app/dashboard/_components/DashboardCreateBookingDialog';
import { Spotlight } from '@/components/aceternity/spotlight';
import { DashboardTabMotionEnhancer } from '@/components/dashboard/dashboard-tab-motion-enhancer';
import { DashboardConfirmProvider } from '@/components/dashboard/dashboard-confirm-provider';
import { useLanguage } from '@/context/LanguageContext';
import { DashboardPageTransition } from '@/components/dashboard/dashboard-page-transition';
import {
  DashboardCustomizationProvider,
  useDashboardCustomization,
} from '@/app/dashboard/_components/DashboardCustomization';

const dashboardSurfaceStyles = `
  /* The selected dashboard preset controls every shared semantic color token. */
  .silentra-dashboard-shell {
    --primary: var(--dashboard-accent, #34d399);
    --color-primary: var(--dashboard-accent, #34d399);
    --primary-foreground: #07110d;
    --color-primary-foreground: #07110d;
    --accent: color-mix(in srgb, var(--dashboard-accent, #34d399) 14%, transparent);
    --color-accent: color-mix(in srgb, var(--dashboard-accent, #34d399) 14%, transparent);
    --ring: color-mix(in srgb, var(--dashboard-accent, #34d399) 68%, transparent);
    --color-ring: color-mix(in srgb, var(--dashboard-accent, #34d399) 68%, transparent);
    --sidebar-primary: var(--dashboard-accent, #34d399);
    --color-sidebar-primary: var(--dashboard-accent, #34d399);
    --sidebar-ring: color-mix(in srgb, var(--dashboard-accent, #34d399) 68%, transparent);
    --color-sidebar-ring: color-mix(in srgb, var(--dashboard-accent, #34d399) 68%, transparent);
  }

  .silentra-dashboard-shell .dashboard-page {
    position: relative;
    background: transparent;
  }

  /* The agenda workspace is full-bleed: its outer shells add no general padding. */
  .silentra-dashboard-shell .dashboard-content.dashboard-agenda-content #dashboard-main-content.dashboard-agenda-main,
  .silentra-dashboard-shell .dashboard-page.dashboard-agenda-page {
    padding: 0 !important;
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

  /* Route headers, filters, nested panels and export tiles share the same light glass surface. */
  .silentra-dashboard-shell .dashboard-page [class*="bg-card"],
  .silentra-dashboard-shell .dashboard-page [class*="bg-background"],
  .silentra-dashboard-shell .dashboard-page [class*="bg-muted/"] {
    background-color: rgb(255 255 255 / 0.018) !important;
    backdrop-filter: blur(18px) saturate(120%);
    -webkit-backdrop-filter: blur(18px) saturate(120%);
  }

  .silentra-dashboard-shell .dashboard-page [class*="border-border"],
  .silentra-dashboard-shell .dashboard-page [class*="border-white/"] {
    border-color: rgb(255 255 255 / 0.055) !important;
  }

  .silentra-dashboard-shell .dashboard-page :focus-visible {
    outline-color: var(--dashboard-accent, #34d399);
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

  /* Settings content is rendered directly inside its accordion, not as nested cards. */
  .silentra-dashboard-shell .dashboard-page .settings-accordion-content {
    width: 100%;
    min-width: 0;
  }

  /* Keep the open Settings category tied to the user's dashboard accent color. */
  .silentra-dashboard-shell .dashboard-page .settings-accordion[open] {
    border-color: color-mix(in srgb, var(--dashboard-accent, #34d399) 52%, rgb(255 255 255 / 0.08)) !important;
    background: color-mix(in srgb, var(--dashboard-accent, #34d399) 5%, rgb(255 255 255 / 0.012)) !important;
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--dashboard-accent, #34d399) 12%, transparent),
      0 12px 30px color-mix(in srgb, var(--dashboard-accent, #34d399) 5%, transparent) !important;
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion[open] > summary {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--dashboard-accent, #34d399) 10%, transparent),
      transparent 72%
    );
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion[open] > summary > span > span:first-child,
  .silentra-dashboard-shell .dashboard-page .settings-accordion[open] > summary > svg {
    color: var(--dashboard-accent, #34d399);
  }

  /* Nested Settings accordions use the same accent with a quieter emphasis. */
  .silentra-dashboard-shell .dashboard-page .settings-subaccordion[open] {
    border-color: color-mix(in srgb, var(--dashboard-accent, #34d399) 34%, rgb(255 255 255 / 0.08)) !important;
    background: color-mix(in srgb, var(--dashboard-accent, #34d399) 3%, transparent) !important;
  }

  .silentra-dashboard-shell .dashboard-page .settings-subaccordion[open] > summary {
    background: color-mix(in srgb, var(--dashboard-accent, #34d399) 6%, transparent);
  }

  .silentra-dashboard-shell .dashboard-page .settings-subaccordion[open] > summary > span > span:first-child,
  .silentra-dashboard-shell .dashboard-page .settings-subaccordion[open] > summary > svg {
    color: var(--dashboard-accent, #34d399);
  }

  /* All Settings accordions share the account and security header treatment. */
  .silentra-dashboard-shell .dashboard-page .settings-accordion > summary,
  .silentra-dashboard-shell .dashboard-page .settings-subaccordion > summary {
    position: relative;
    min-height: 5.25rem;
    transition: background 180ms ease, color 180ms ease;
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion > summary::before,
  .silentra-dashboard-shell .dashboard-page .settings-subaccordion > summary::before {
    position: absolute;
    inset-block: 1rem;
    left: 0;
    width: 3px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--dashboard-accent, #34d399) 38%, transparent);
    content: "";
    transition: background 180ms ease, inset-block 180ms ease;
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion[open] > summary::before,
  .silentra-dashboard-shell .dashboard-page .settings-subaccordion[open] > summary::before {
    inset-block: 0.65rem;
    background: var(--dashboard-accent, #34d399);
  }

  .silentra-dashboard-shell .dashboard-page .account-security-icon {
    display: grid;
    width: 2.85rem;
    height: 2.85rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--dashboard-accent, #34d399) 28%, rgb(255 255 255 / 0.1));
    border-radius: 1rem;
    background: color-mix(in srgb, var(--dashboard-accent, #34d399) 10%, rgb(255 255 255 / 0.025));
    color: var(--dashboard-accent, #34d399);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
    transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
  }

  .silentra-dashboard-shell .dashboard-page .settings-account-security[open] .account-security-icon {
    transform: translateY(-1px);
    background: color-mix(in srgb, var(--dashboard-accent, #34d399) 16%, rgb(255 255 255 / 0.025));
    box-shadow: 0 8px 24px color-mix(in srgb, var(--dashboard-accent, #34d399) 12%, transparent);
  }

  .silentra-dashboard-shell .dashboard-page .account-security-eyebrow,
  .silentra-dashboard-shell .dashboard-page .account-security-panel-eyebrow {
    display: block;
    color: color-mix(in srgb, var(--dashboard-accent, #34d399) 78%, rgb(255 255 255 / 0.55));
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .silentra-dashboard-shell .dashboard-page .account-security-count {
    display: inline-flex;
    min-height: 1.75rem;
    align-items: center;
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.035);
    padding: 0.25rem 0.625rem;
    color: rgb(161 161 170 / 0.95);
    font-size: 0.6875rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .silentra-dashboard-shell .dashboard-page .settings-account-security[open] .account-security-count {
    border-color: color-mix(in srgb, var(--dashboard-accent, #34d399) 24%, rgb(255 255 255 / 0.08));
    background: color-mix(in srgb, var(--dashboard-accent, #34d399) 8%, transparent);
    color: var(--dashboard-accent, #34d399);
  }

  .silentra-dashboard-shell .dashboard-page .settings-account-security .settings-accordion-content {
    display: grid;
    gap: 0.75rem;
    border-top: 1px solid rgb(255 255 255 / 0.07);
    padding: 1rem !important;
  }

  .silentra-dashboard-shell .dashboard-page .settings-account-security-panel {
    min-width: 0;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 1rem;
    background: linear-gradient(135deg, rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.012));
    padding: 1rem;
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }

  .silentra-dashboard-shell .dashboard-page .settings-account-security-panel:hover {
    border-color: color-mix(in srgb, var(--dashboard-accent, #34d399) 24%, rgb(255 255 255 / 0.075));
    background: linear-gradient(135deg, color-mix(in srgb, var(--dashboard-accent, #34d399) 5%, rgb(255 255 255 / 0.025)), rgb(255 255 255 / 0.012));
  }

  .silentra-dashboard-shell .dashboard-page .account-security-panel-icon {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 0.85rem;
    background: rgb(255 255 255 / 0.045);
    color: var(--dashboard-accent, #34d399);
  }

  .silentra-dashboard-shell .dashboard-page .account-security-panel-icon--danger {
    border-color: rgb(244 63 94 / 0.2);
    background: rgb(244 63 94 / 0.075);
    color: rgb(251 113 133);
  }

  .silentra-dashboard-shell .dashboard-page .account-security-panel-eyebrow--danger {
    color: rgb(251 113 133);
  }

  .silentra-dashboard-shell .dashboard-page .settings-account-security-panel--danger {
    border-color: rgb(244 63 94 / 0.18);
    background: linear-gradient(135deg, rgb(244 63 94 / 0.055), rgb(255 255 255 / 0.01));
  }

  .silentra-dashboard-shell .dashboard-page .settings-account-security-panel--danger:hover {
    border-color: rgb(244 63 94 / 0.32);
    background: linear-gradient(135deg, rgb(244 63 94 / 0.085), rgb(255 255 255 / 0.015));
  }

  @media (max-width: 639px) {
    .silentra-dashboard-shell .dashboard-page .settings-account-security .settings-accordion-content {
      padding: 0.75rem !important;
    }

    .silentra-dashboard-shell .dashboard-page .settings-account-security-panel {
      padding: 0.875rem;
    }

    .silentra-dashboard-shell .dashboard-page .account-security-count {
      display: none;
    }
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion-content [data-slot="card"] {
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    gap: 0 !important;
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion-content [data-slot="card-header"] {
    padding: 0 0 0.75rem !important;
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion-content [data-slot="card-content"],
  .silentra-dashboard-shell .dashboard-page .settings-accordion-content [data-slot="card-footer"] {
    padding: 0 !important;
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion-content [data-slot="card-description"] {
    color: rgb(161 161 170 / 0.82);
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion-content input,
  .silentra-dashboard-shell .dashboard-page .settings-accordion-content textarea,
  .silentra-dashboard-shell .dashboard-page .settings-accordion-content [data-slot="select-trigger"],
  .silentra-dashboard-shell .dashboard-page .settings-accordion-content select {
    background-color: rgb(255 255 255 / 0.035);
  }

  .silentra-dashboard-shell .dashboard-page .settings-accordion-content .settings-subaccordion {
    background: transparent;
  }

  /* Mobile viewport guard: dashboard content must not inherit desktop canvas widths. */
  @media (max-width: 767px) {
    .silentra-dashboard-shell {
      width: 100%;
      max-width: 100%;
      overflow-x: clip;
    }

    .silentra-dashboard-shell .dashboard-content,
    .silentra-dashboard-shell .silentra-dashboard-main,
    .silentra-dashboard-shell .dashboard-page {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      margin-inline: 0;
      box-sizing: border-box;
    }

    .silentra-dashboard-shell .dashboard-page {
      padding-inline: 1rem;
    }

    .silentra-dashboard-shell .dashboard-page > *,
    .silentra-dashboard-shell .dashboard-page [data-slot="card"] {
      min-width: 0;
      max-width: 100%;
    }
  }

  @media (max-width: 1023px) {
    .silentra-dashboard-shell .dashboard-page {
      padding-bottom: calc(6.25rem + env(safe-area-inset-bottom));
    }
  }

  @media (min-width: 1024px) {
    .silentra-dashboard-shell .dashboard-page {
      padding-bottom: 2.5rem;
    }
  }
`;

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { config: dashboardConfig } = useDashboardCustomization();
  const accentColor = dashboardConfig.accentColor;
  const isSettingsPage = pathname.startsWith('/dashboard/settings');
  const isAgendaPage = pathname === '/dashboard/agenda';

  // Disable browser/page zoom while the user is inside the dashboard.
  // Restore the site's original viewport configuration when leaving it.
  useEffect(() => {
    if (!pathname.startsWith('/dashboard')) return;

    const viewport = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    const previousViewportContent = viewport?.content ?? null;

    if (viewport) {
      const directives = new Map(
        viewport.content
          .split(',')
          .map((part): [string, string] => {
            const [key, value = ''] = part
              .trim()
              .split('=')
              .map((entry) => entry.trim());
            return [key, value];
          })
          .filter(([key]) => Boolean(key)),
      );
      directives.set('width', 'device-width');
      directives.set('initial-scale', '1');
      directives.set('maximum-scale', '1');
      directives.set('user-scalable', 'no');
      viewport.content = Array.from(directives, ([key, value]) =>
        value ? `${key}=${value}` : key,
      ).join(', ');
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1 && event.cancelable) {
        event.preventDefault();
      }
    };
    const handleWheel = (event: WheelEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.cancelable) {
        event.preventDefault();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        ['+', '=', '-', '_', '0', 'Add', 'Subtract'].includes(event.key)
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    window.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
      if (viewport && previousViewportContent !== null) {
        viewport.content = previousViewportContent;
      }
    };
  }, [pathname]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousAccent = root.style.getPropertyValue('--dashboard-accent');
    const previousTheme = body.getAttribute('data-dashboard-theme');

    root.style.setProperty('--dashboard-accent', accentColor);
    body.setAttribute('data-dashboard-theme', 'true');

    return () => {
      if (previousAccent) {
        root.style.setProperty('--dashboard-accent', previousAccent);
      } else {
        root.style.removeProperty('--dashboard-accent');
      }
      if (previousTheme === null) {
        body.removeAttribute('data-dashboard-theme');
      } else {
        body.setAttribute('data-dashboard-theme', previousTheme);
      }
    };
  }, [accentColor]);

  return (
    <div
      className="silentra-dashboard-shell"
      style={{ '--dashboard-accent': accentColor } as React.CSSProperties}
    >
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
      <DashboardCreateBookingDialog />
      <div
        className={`dashboard-content min-w-0 lg:pl-64 ${
          isSettingsPage ? 'pt-0' : 'pt-16'
        } ${isAgendaPage ? 'dashboard-agenda-content' : ''}`}
      >
        <DashboardPageTransition>
          <main
            id="dashboard-main-content"
            tabIndex={-1}
            className={`dashboard-page mx-auto max-w-[1600px] ${isAgendaPage ? 'dashboard-agenda-main p-0' : 'py-5 sm:py-7'}`}
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
    <DashboardCustomizationProvider>
      <BarbershopProvider>
        <DashboardConfirmProvider>
          <Spotlight className="opacity-80" />
          <DashboardContent>{children}</DashboardContent>
        </DashboardConfirmProvider>
      </BarbershopProvider>
    </DashboardCustomizationProvider>
  );
}
