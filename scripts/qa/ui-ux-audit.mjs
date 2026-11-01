import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [
  dashboardConfirmProvider,
  overviewPage,
  clientsListCard,
  servicesListCard,
  automationPage,
  marketingWorkspace,
  settingsPage,
] = await Promise.all([
  read('components/dashboard/dashboard-confirm-provider.tsx'),
  read('app/dashboard/page.tsx'),
  read('app/dashboard/_components/cards/ClientsListCard.tsx'),
  read('app/dashboard/_components/cards/ServicesListCard.tsx'),
  read('app/dashboard/automations/page.tsx'),
  read('app/dashboard/marketing/marketing-workspace.tsx'),
  read('app/dashboard/settings/settings-page.tsx'),
]);
const confirmationTargets = await Promise.all(
  [
    'app/dashboard/pos/page.tsx',
    'app/dashboard/pos/loja/page.tsx',
    'app/dashboard/loyalty/page.tsx',
    'app/dashboard/pos/pedidos/page.tsx',
    'app/dashboard/pos/produtos/page.tsx',
    'app/dashboard/_components/team/TeamMembersManager.tsx',
    'app/dashboard/marketing/campaign-lifecycle-actions.tsx',
    'components/dashboard/loyalty/earning-rules-card.tsx',
    'components/billing/BillingHub.tsx',
  ].map((file) => read(file)),
);

const [
  navbar,
  sidebar,
  globalCss,
  responsiveCss,
  dashboardShell,
  topBar,
  button,
  supportService,
  emailMigration,
] = await Promise.all([
  read('components/site-navbar.tsx'),
  read('app/dashboard/_components/DashboardSidebar.tsx'),
  read('app/globals.css'),
  read('app/silentra-responsive.css'),
  read('app/dashboard/dashboard-content.tsx'),
  read('app/dashboard/_components/DashboardTopBar.tsx'),
  read('components/ui/button.tsx'),
  read('services/support/support-chat.service.ts'),
  read('supabase/migrations/20261017122241_support_notify_every_message.sql'),
]);

// Navigation correctness: catch the old English slugs that silently led to 404s.
assert.match(navbar, /href: '\/dashboard\/clientes'/);
assert.match(sidebar, /href: '\/dashboard\/equipa'/);
assert.doesNotMatch(navbar, /href: '\/dashboard\/clients'/);
assert.doesNotMatch(navbar, /href: '\/dashboard\/team'/);
for (const route of [
  'app/dashboard/page.tsx',
  'app/dashboard/agenda/page.tsx',
  'app/dashboard/clientes/page.tsx',
  'app/dashboard/servicos/page.tsx',
  'app/dashboard/equipa/page.tsx',
  'app/dashboard/settings/page.tsx',
  'app/dashboard/suporte/page.tsx',
]) {
  await access(route);
}

// Navigation density, fixed bottom placement and the More sheet must stay consistent.
assert.match(
  sidebar,
  /const primaryItems:[\s\S]*?\/dashboard\/agenda[\s\S]*?\/dashboard\/clientes[\s\S]*?\/dashboard\/servicos/,
);
assert.match(sidebar, /const teamItems: SidebarItem\[\]/);
assert.match(sidebar, /const communicationItems: SidebarItem\[\]/);
assert.match(sidebar, /const toolsItems: SidebarItem\[\]/);
assert.match(sidebar, /const secondaryItems: SidebarItem\[\]/);
assert.match(sidebar, /fixed left-1\/2 bottom-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
assert.match(sidebar, /w-\[min\(28rem,calc\(100vw-1\.5rem\)\)\]/);
assert.match(sidebar, /rounded-\[1\.35rem\] border border-white\/10/);
assert.match(sidebar, /active:scale-\[0\.96\]/);
assert.match(sidebar, /lg:bottom-5/);
assert.match(sidebar, /aria-expanded=\{moreOpen\}/);
assert.match(sidebar, /aria-controls="dashboard-more-panel"/);
assert.match(sidebar, /aria-modal="true"/);
assert.match(sidebar, /AnimatePresence/);
assert.match(sidebar, /motion\.aside/);
assert.match(sidebar, /TooltipProvider/);
assert.match(sidebar, /TooltipTrigger asChild/);
assert.match(sidebar, /TooltipContent/);
assert.match(sidebar, /side="top"/);
assert.match(sidebar, /rotateX: -5/);
assert.match(sidebar, /transformOrigin: 'bottom center'/);
assert.doesNotMatch(sidebar, /lg:absolute lg:bottom-\[calc\(100%\+0\.85rem\)\]/);
assert.match(sidebar, /prefersReducedMotion/);
assert.match(sidebar, /env\(safe-area-inset-bottom\)/);
const mobileDashboardShellRule = responsiveCss.match(
  /Mobile dashboard must behave[\s\S]*?\.silentra-dashboard-shell\s*\{([^}]*)\}/,
)?.[1] ?? '';
assert.ok(mobileDashboardShellRule, 'Mobile dashboard shell rule must exist');
assert.match(mobileDashboardShellRule, /overflow-x:\s*clip/);
assert.doesNotMatch(
  mobileDashboardShellRule,
  /contain:\s*(?:paint|layout|strict|content)/,
  'Mobile dashboard shell must not establish a containing block for the fixed dock',
);
assert.match(sidebar, /handleDialogKeys/);
assert.match(sidebar, /moreTriggerRef\.current\?\.focus\(\)/);
assert.match(sidebar, /moreItems\.some\(isActive\)/);
assert.match(sidebar, /localizeNavLabel\(item\.label, locale\)/);
// Settings stay on one page: no category switcher, modal editor, or shortcut step.
assert.doesNotMatch(settingsPage, /const sectionGroups|navigationGroups|setSection|activeDialog|SettingsDialog/);
assert.doesNotMatch(settingsPage, /<Dialog|<DialogContent|<DialogFooter|closeSettingsDialog/);
assert.doesNotMatch(settingsPage, /<aside|settingsPage\.navigation|settingsPage\.section/);
assert.doesNotMatch(settingsPage, /onClick=\{\(\) => go\(/);
assert.doesNotMatch(settingsPage, /settingsPage\.overviewTitle|completedSetupSteps|role="progressbar"/);
for (const category of ['business', 'location', 'hours', 'rules']) {
  assert.match(
    settingsPage,
    new RegExp(`<section id="settings-${category}"`),
    `Settings ${category} form must be visible inline`,
  );
}
assert.match(settingsPage, /settingsPage\.rulesDialogDescription/);
assert.match(settingsPage, /settingsPage\.cancellationWindowHelp/);
assert.match(settingsPage, /settingsPage\.cancellationWindowNoLimit/);
assert.match(settingsPage, /const INPUT_CLASS = 'min-h-11 max-w-sm/);
assert.match(settingsPage, /async function saveAll\(\)/);
assert.match(settingsPage, /onClick=\{\(\) => void saveAll\(\)\}/);
assert.match(settingsPage, /sticky top-0/);
assert.match(settingsPage, /setLocale\(n\.default_language\)/);
assert.match(settingsPage, /canManualMbway/);
assert.match(settingsPage, /automationAllowed/);
assert.doesNotMatch(settingsPage, /<select\b/);
assert.match(settingsPage, /<SelectTrigger/);
assert.match(settingsPage, /<SelectContent/);

// Public navigation stays compact at desktop widths and uses a reduced mobile menu.
assert.match(navbar, /className="hidden min-w-0 items-center gap-1 lg:flex"/);
assert.match(navbar, /className="lg:hidden"/);
assert.match(navbar, /const guestLinks = useMemo<NavLink\[\]>/);
assert.match(navbar, /href: '\/software-gestao-barbearia'/);
assert.match(sidebar, /href: '\/dashboard\/automations'/);
assert.doesNotMatch(sidebar, /href: '\/dashboard\/mensagens\/birthdays'/);
assert.doesNotMatch(sidebar, /label: 'Aniversários'/);
assert.match(automationPage, /MarketingWorkspace initialView="automation"/);
assert.match(marketingWorkspace, /createBirthdayAutomation/);
assert.match(marketingWorkspace, /Adicionar automaticamente/);
assert.match(marketingWorkspace, /triggerType: 'birthday'/);

// Dialogs for mutations and forms are shared, accessible and not browser-native.
assert.match(dashboardShell, /DashboardConfirmProvider/);
assert.match(dashboardConfirmProvider, /AlertDialog/);
assert.match(dashboardConfirmProvider, /aria|AlertDialogTitle/);
assert.match(clientsListCard, /<Dialog open=\{showAddClientForm\}/);
assert.match(servicesListCard, /<Dialog open=\{showAddServiceForm\}/);
assert.match(overviewPage, /role="img"/);
assert.match(overviewPage, /grid h-full min-w-0 grid-cols-7/);
assert.match(overviewPage, /maxBookings/);
assert.doesNotMatch(overviewPage, /maxRevenue/);
assert.match(overviewPage, /point.bookings > 0/);
assert.doesNotMatch(overviewPage, /dashboard.chartLegend/);
for (const source of confirmationTargets) {
  assert.match(source, /useDashboardConfirm/);
  assert.doesNotMatch(source, /window\.confirm/);
}

// Settings should expose focused, independently saveable dialogs instead of one long form.
for (const category of ['business', 'location', 'hours', 'rules']) {
  assert.ok(
    settingsPage.includes(`open={activeDialog === '${category}'}`),
    `Settings ${category} form must have its own dialog`,
  );
}
assert.match(settingsPage, /settingsPage\.rulesDialogDescription/);
assert.match(settingsPage, /settingsPage\.cancellationWindowHelp/);
assert.match(settingsPage, /settingsPage\.cancellationWindowNoLimit/);
assert.match(settingsPage, /const INPUT_CLASS = 'min-h-11 max-w-sm/);
assert.match(settingsPage, /role="progressbar"/);
assert.match(settingsPage, /completedSetupSteps/);
assert.match(settingsPage, /function closeSettingsDialog\(\)/);
assert.doesNotMatch(settingsPage, /<select\b/);
assert.match(settingsPage, /<SelectTrigger/);
assert.match(settingsPage, /<SelectContent/);

// Dashboard zoom is fully disabled while preserving the site's viewport elsewhere.
assert.match(dashboardShell, /maximum-scale', '1'/);
assert.match(dashboardShell, /user-scalable', 'no'/);
assert.match(dashboardShell, /event\.touches\.length > 1/);
assert.match(dashboardShell, /event\.ctrlKey \|\| event\.metaKey/);
assert.match(dashboardShell, /\['\+', '=', '-', '_', '0', 'Add', 'Subtract'\]/);
assert.match(dashboardShell, /previousViewportContent/);
assert.match(dashboardShell, /viewport\.content = previousViewportContent/);

// Core accessibility regressions: keyboard focus, landmarks, target sizes and motion.
assert.match(navbar, /keepFocusInside/);
assert.match(navbar, /aria-controls="site-navigation-overlay"/);
assert.match(dashboardShell, /href="#dashboard-main-content"/);
assert.match(dashboardShell, /id="dashboard-main-content"/);
assert.match(dashboardShell, /isSettingsPage \? 'pt-0' : 'pt-16'/);
assert.match(topBar, /aria-current="page"/);
assert.doesNotMatch(topBar, /setInterval/);
assert.match(globalCss, /:focus-visible/);
assert.match(globalCss, /\.skip-link/);
assert.match(globalCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(globalCss, /overflow-wrap: anywhere/);
assert.match(button, /min-h-11/);

// Every new support message gets a queue entry and read state cannot suppress email.
assert.match(emailMigration, /Every message has a unique outbox entry/i);
assert.match(
  emailMigration,
  /insert into public\.support_email_notifications/i,
);
assert.doesNotMatch(
  emailMigration,
  /v_unread_count|if\s+v_unread_count\s*=\s*0/i,
);
assert.doesNotMatch(supportService, /if \(messageResult\.data\.read_at\)/);

console.log('UI/UX and accessibility contract audit passed.');
