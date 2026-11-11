import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [
  agendaLayoutSettings,
  publicProfileSettingsCard,
  publicProfileRoute,
  publicProfileApi,
] = await Promise.all([
  read('app/dashboard/settings/agenda-view-settings.tsx'),
  read('app/dashboard/settings/public-profile/public-profile-settings-card.tsx'),
  read('app/dashboard/settings/public-profile/page.tsx'),
  read('app/api/barbershops/public-profile/route.ts'),
]);

const [
  dashboardConfirmProvider,
  overviewPage,
  clientsListCard,
  servicesListCard,
  automationPage,
  marketingWorkspace,
  settingsPage,
  agendaCancellationPolicy,
  globalBookingDialog,
] = await Promise.all([
  read('components/dashboard/dashboard-confirm-provider.tsx'),
  read('app/dashboard/page.tsx'),
  read('app/dashboard/_components/cards/ClientsListCard.tsx'),
  read('app/dashboard/_components/cards/ServicesListCard.tsx'),
  read('app/dashboard/automations/page.tsx'),
  read('app/dashboard/marketing/marketing-workspace.tsx'),
  read('app/dashboard/settings/settings-page.tsx'),
  read('components/dashboard/agenda-cancellation-policy-panel.tsx'),
  read('app/dashboard/_components/DashboardCreateBookingDialog.tsx'),
]);
const settingsPushNotifications = await read('components/dashboard/settings-push-notifications-panel.tsx');

const confirmationTargets = await Promise.all(
  [
    'app/dashboard/pos/page.tsx',
    'app/dashboard/pos/loja/page.tsx',
    'app/dashboard/loyalty/page.tsx',
    'app/dashboard/pos/pedidos/page.tsx',
    'app/dashboard/pos/produtos/page.tsx',
    'app/dashboard/_components/team/TeamMembersManager.tsx',
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
  agendaPage,
  appointmentMobileCard,
  appointmentsTable,
  appointmentActions,
  bodyScrollLock,
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
  read('app/dashboard/agenda/page.tsx'),
  read('components/dashboard/appointment-mobile-card.tsx'),
  read('components/dashboard/appointments-table.tsx'),
  read('components/dashboard/appointment-actions.tsx'),
  read('lib/ui/body-scroll-lock.ts'),
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
  /const primaryItems:[\s\S]*?href: '\/dashboard'[\s\S]*?href: '\/dashboard\/agenda'[\s\S]*?href: '\/dashboard\/analytics'/,
  'Dock order must be Home, Agenda and Reports around the central create action.',
);
assert.match(sidebar, /primaryItems\.slice\(0, 2\)\.map\(renderDockItem\)/);
assert.doesNotMatch(sidebar, /href="\/dashboard\/agenda\?create=1"/);
assert.match(sidebar, /window\.dispatchEvent\(new Event\('silentra:open-create-booking'\)\)/);
assert.match(dashboardShell, /DashboardCreateBookingDialog/);
assert.match(globalBookingDialog, /window\.addEventListener\(OPEN_CREATE_EVENT/);
assert.match(globalBookingDialog, /useAppointments\(barbershopId, refreshBookingData\)/);
assert.match(globalBookingDialog, /<Dialog open=\{open\} onOpenChange=\{handleOpenChange\}>/);
assert.doesNotMatch(globalBookingDialog, /pathname\.startsWith\('\/dashboard\/agenda'\)/);
assert.match(globalBookingDialog, /silentra:appointments-updated/);
assert.match(sidebar, /primaryItems\.slice\(2\)\.map\(renderDockItem\)/);
assert.match(sidebar, /silentra:open-create-booking/);
assert.match(sidebar, /managementItems\.map\(renderItem\)/);
assert.match(sidebar, /'Gestão', 'Management'/);
assert.match(agendaPage, /silentra:appointments-updated/);
assert.match(agendaPage, /window\.dispatchEvent\(new Event\('silentra:open-create-booking'\)\)/);
assert.doesNotMatch(agendaPage, /window\.addEventListener\('silentra:open-create-booking'/);
assert.match(agendaPage, /searchParams\.get\('create'\) === '1'/);
assert.doesNotMatch(agendaPage, /<AgendaViewSettings|<AgendaCancellationPolicyPanel/);
assert.match(sidebar, /const teamItems: SidebarItem\[\]/);
assert.match(sidebar, /const automationItems: SidebarItem\[\]/);
assert.doesNotMatch(sidebar, /communicationItems|dashboard\/mensagens|dashboard\/marketing/);
assert.match(sidebar, /const toolsItems: SidebarItem\[\]/);
assert.match(sidebar, /const secondaryItems: SidebarItem\[\]/);
assert.match(
  sidebar,
  /fixed left-1\/2 bottom-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/,
);
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
assert.doesNotMatch(
  sidebar,
  /lg:absolute lg:bottom-\[calc\(100%\+0\.85rem\)\]/,
);
assert.match(sidebar, /prefersReducedMotion/);
assert.match(sidebar, /env\(safe-area-inset-bottom\)/);
const mobileDashboardShellRule =
  responsiveCss.match(
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
// Desktop navigation uses a dedicated fixed sidebar; mobile retains the bottom dock.
assert.match(sidebar, /hidden w-64 flex-col[\s\S]*?lg:flex/);
assert.match(sidebar, /Navegação principal da dashboard/);
assert.match(sidebar, /Criar marcação/);
assert.match(sidebar, /primaryItems\.slice\(0, 2\)\.map\(renderItem\)/);
assert.match(sidebar, /managementItems\.map\(renderItem\)/);
assert.match(sidebar, /secondaryItems\.map\(renderItem\)/);
assert.match(sidebar, /lg:hidden/);
assert.match(dashboardShell, /lg:pl-64/);
assert.match(dashboardShell, /const isAgendaPage = pathname === '\/dashboard\/agenda'/);
assert.match(dashboardShell, /dashboard-agenda-content/);
assert.match(
  dashboardShell,
  /dashboard-content\.dashboard-agenda-content #dashboard-main-content/,
);

assert.match(
  dashboardShell,
  /dashboard-page\.dashboard-agenda-page[\s\S]*?padding-inline:\s*0 !important/,
  'The agenda shell must remove horizontal padding on mobile.',
);
assert.match(agendaPage, /dashboard-agenda-page/);
assert.match(agendaPage, /max-w-\[100rem\] px-0 py-5 sm:px-5/);

assert.match(topBar, /lg:left-64/);

// Settings stay on one page: no category switcher, modal editor, or shortcut step.
assert.doesNotMatch(
  settingsPage,
  /const sectionGroups|navigationGroups|setSection|activeDialog|SettingsDialog/,
);
assert.doesNotMatch(
  settingsPage,
  /<Dialog|<DialogContent|<DialogFooter|closeSettingsDialog/,
);
assert.doesNotMatch(
  settingsPage,
  /<aside|settingsPage\.navigation|settingsPage\.section/,
);
assert.doesNotMatch(settingsPage, /onClick=\{\(\) => go\(/);
assert.doesNotMatch(
  settingsPage,
  /settingsPage\.overviewTitle|completedSetupSteps|role="progressbar"/,
);
for (const category of ['business', 'location', 'hours', 'rules']) {
  assert.match(
    settingsPage,
    new RegExp(`<section id="settings-${category}"`),
    `Settings ${category} form must be visible inline`,
  );
}
assert.match(settingsPage, /settingsPage\.rulesDialogDescription/);
assert.match(settingsPage, /data-settings-category/);
const accountSecurityMarker = "t('settingsPage.accountSecurity')";
const accountSecurityDetailsStart = settingsPage.lastIndexOf('<details', settingsPage.indexOf(accountSecurityMarker));
const accountSecurityDetailsEnd = settingsPage.indexOf('</details>', accountSecurityDetailsStart);
assert.ok(accountSecurityDetailsStart >= 0 && accountSecurityDetailsEnd > accountSecurityDetailsStart);
const accountSecurityAccordion = settingsPage.slice(accountSecurityDetailsStart, accountSecurityDetailsEnd);
assert.ok(accountSecurityAccordion.includes('id="settings-billing"'), 'Billing must stay inside Account and security.');
assert.ok(accountSecurityAccordion.includes('id="settings-danger"'), 'Permanent barbershop deletion must stay inside Account and security.');
assert.equal(settingsPage.lastIndexOf('<details', settingsPage.indexOf('id="settings-billing"')), accountSecurityDetailsStart);
assert.equal(settingsPage.lastIndexOf('<details', settingsPage.indexOf('id="settings-danger"')), accountSecurityDetailsStart);
assert.match(settingsPage, /window\.location\.hash\.slice\(1\)/, 'Settings hash links must open the containing category.');
assert.match(settingsPage, /target\?\.closest\([\s\S]*?details\[data-settings-category\]/);
assert.ok(settingsPage.includes('data-settings-subcategory'));
assert.ok(
  settingsPage.includes("locale === 'en' ? 'Appearance' : 'Aparência'"),
  'Appearance must be nested under Information.',
);
assert.ok(settingsPage.includes('<AgendaViewSettings />'));
assert.match(settingsPage, /settings-accordion-content/);
assert.doesNotMatch(
  settingsPage,
  /settings-subaccordion[^>]*bg-black\/15/,
  'The nested Appearance accordion must use the same neutral surface as its parent.',
);
assert.match(
  dashboardShell,
  /settings-accordion-content \[data-slot="card"\][\s\S]*?padding: 0 !important/,
  'Cards inside settings accordions must be visually flattened.',
);
assert.doesNotMatch(
  publicProfileSettingsCard,
  /rounded-2xl border border-white\/10 bg-white\/\[0\.025\] p-4 sm:p-5/,
  'Public profile sections must sit directly in the accordion content.',
);
assert.match(publicProfileSettingsCard, /border-t border-white\/\[.08\] pt-4/);
assert.doesNotMatch(settingsPushNotifications, /<Card\b|<CardContent\b|ui\/card/);
assert.match(settingsPushNotifications, /className="w-full min-w-0"/);
assert.match(settingsPage, /<DashboardCustomizationDialog/);
assert.match(settingsPage, /<PublicProfileSettingsCard/);
assert.ok(settingsPage.includes('directoryVisible={config.is_public_in_directory}'));
assert.ok(!settingsPage.includes('href="/dashboard/settings/public-profile"'));
assert.ok(
  settingsPage.indexOf('id="settings-location"') >
    settingsPage.indexOf("'Information' : 'Informações'"),
  'Location settings must be nested under Information.',
);
assert.ok(
  settingsPage.indexOf("'Appearance' : 'Aparência'") >
    settingsPage.indexOf("'Information' : 'Informações'"),
  'Appearance settings must be nested under Information.',
);
assert.match(agendaLayoutSettings, /aria-pressed=\{view === 'lines'\}/);
assert.match(agendaLayoutSettings, /aria-pressed=\{view === 'calendar'\}/);
assert.match(agendaLayoutSettings, /setView\('lines'\)/);
assert.match(agendaLayoutSettings, /setView\('calendar'\)/);
assert.match(publicProfileSettingsCard, /Visibilidade no diretório/);
assert.match(publicProfileSettingsCard, /directoryVisible/);
assert.match(publicProfileSettingsCard, /public_profile_enabled/);
assert.match(publicProfileSettingsCard, /publicProfileEnabled/);
assert.match(publicProfileSettingsCard, /publicPageVisibility/);
assert.match(publicProfileApi, /'publicProfileEnabled'/);
assert.match(publicProfileApi, /updates\.public_profile_enabled = body\.publicProfileEnabled/);
assert.match(publicProfileSettingsCard, /Guardar alterações no topo das Definições/);
assert.ok(publicProfileRoute.includes("redirect('/dashboard/settings#public-profile')"));
assert.match(settingsPage, /time_limit_cancellation_hours/);
assert.match(settingsPage, /value=\{String\(config\.time_limit_cancellation_hours\)\}/);
assert.match(agendaCancellationPolicy, /time_limit_cancellation_hours/);
assert.match(agendaCancellationPolicy, /Cancellation policy/);
assert.ok(
  settingsPage.includes('const INPUT_CLASS =') &&
    settingsPage.includes(
      "'box-border block min-h-11 w-full min-w-0 max-w-full",
    ),
  'Settings input class must remain mobile-safe',
);
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
assert.doesNotMatch(sidebar, /href: '\/dashboard\/settings\/public-profile'/);
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

// Settings stay consolidated into one inline page with a single save flow.
for (const category of ['business', 'location', 'hours', 'rules']) {
  assert.match(
    settingsPage,
    new RegExp(`<section id="settings-${category}"`),
    `Settings ${category} form must remain visible inline`,
  );
}
assert.match(settingsPage, /settingsPage\.rulesDialogDescription/);
assert.match(agendaCancellationPolicy, /time_limit_cancellation_hours/);
assert.match(agendaCancellationPolicy, /Cancellation policy/);
assert.ok(
  settingsPage.includes('const INPUT_CLASS =') &&
    settingsPage.includes(
      "'box-border block min-h-11 w-full min-w-0 max-w-full",
    ),
  'Settings input class must remain mobile-safe',
);
assert.match(settingsPage, /async function saveAll\(\)/);
assert.match(settingsPage, /onClick=\{\(\) => void saveAll\(\)\}/);
assert.doesNotMatch(
  settingsPage,
  /<Dialog|activeDialog|closeSettingsDialog|role="progressbar"|completedSetupSteps/,
);
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
assert.match(navbar, /lockBodyScroll\(\)/);
assert.match(
  navbar,
  /min-h-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto overscroll-contain touch-pan-y/,
);
assert.match(sidebar, /lockBodyScroll\(\)/);
assert.match(bodyScrollLock, /body\.style\.position = 'fixed'/);
assert.match(bodyScrollLock, /root\.style\.overscrollBehavior = 'none'/);
assert.match(bodyScrollLock, /window\.scrollTo\(0, scrollY\)/);
assert.match(agendaPage, /Gerir marcações/);
assert.match(
  agendaPage,
  /grid gap-3 px-3 py-3 sm:grid-cols-2 sm:px-4 xl:hidden/,
);
assert.match(agendaPage, /className="hidden xl:block"/);
assert.match(agendaPage, /locale=\{locale\}/);
assert.match(appointmentMobileCard, /date\.toLocaleDateString\(languageTag/);
assert.match(
  appointmentMobileCard,
  /AppointmentActions[\s\S]*?locale=\{locale\}/,
);
assert.match(appointmentsTable, /min-w-\[900px\]/);
assert.match(appointmentsTable, /locale=\{locale\}/);
assert.match(appointmentActions, /locale = 'pt'/);
assert.match(appointmentActions, /View details/);
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
