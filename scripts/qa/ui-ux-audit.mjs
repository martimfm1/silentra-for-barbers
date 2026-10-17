import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [
  navbar,
  sidebar,
  globalCss,
  dashboardShell,
  topBar,
  button,
  supportService,
  emailMigration,
] = await Promise.all([
  read('components/site-navbar.tsx'),
  read('app/dashboard/_components/DashboardSidebar.tsx'),
  read('app/globals.css'),
  read('app/dashboard/dashboard-content.tsx'),
  read('app/dashboard/_components/DashboardTopBar.tsx'),
  read('components/ui/button.tsx'),
  read('services/support/support-chat.service.ts'),
  read('supabase/migrations/20261017130000_support_notify_every_message.sql'),
]);

// Navigation correctness: catch the old English slugs that silently led to 404s.
assert.match(navbar, /href: '\/dashboard\/clientes'/);
assert.match(navbar, /href: '\/dashboard\/equipa'/);
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

// Navigation density and disclosure controls must remain understandable.
assert.match(sidebar, /const primaryItems:[\s\S]*?\/dashboard\/agenda[\s\S]*?\/dashboard\/clientes[\s\S]*?\/dashboard\/servicos/);
assert.match(sidebar, /communicationItems\.map\(\(item\) => renderItem\(item, mobile\)\)/);
assert.match(sidebar, /const toolsItems: SidebarItem\[\]/);
assert.match(sidebar, /aria-expanded=\{communicationOpen\}/);
assert.match(sidebar, /aria-controls=\{mobile \? 'dashboard-communication-mobile'/);
assert.match(sidebar, /aria-expanded=\{toolsOpen\}/);
assert.match(sidebar, /aria-controls=\{panelId\}/);
assert.match(sidebar, /matchesCurrentPath\(communicationItems\)/);
assert.match(sidebar, /matchesCurrentPath\(toolsItems\)/);
assert.match(sidebar, /localizeNavLabel\(item\.label, locale\)/);
assert.match(sidebar, /handleDialogKeys/);
assert.match(sidebar, /mobileTriggerRef\.current\?\.focus\(\)/);

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
assert.match(emailMigration, /insert into public\.support_email_notifications/i);
assert.doesNotMatch(emailMigration, /v_unread_count|if\s+v_unread_count\s*=\s*0/i);
assert.doesNotMatch(supportService, /if \(messageResult\.data\.read_at\)/);

console.log('UI/UX and accessibility contract audit passed.');
