import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const sidebar = read('app/dashboard/_components/DashboardSidebar.tsx');
const dashboard = read('app/dashboard/page.tsx');
const tools = read('app/dashboard/ferramentas/page.tsx');
const communication = read('app/dashboard/comunicacao/page.tsx');
const messages = read('app/dashboard/mensagens/page.tsx');
const marketingPage = read('app/dashboard/marketing/page.tsx');
const automationsPage = read('app/dashboard/automations/page.tsx');
const workspace = read('app/dashboard/marketing/marketing-workspace.tsx');
const campaignsApi = read('app/api/marketing/campaigns/route.ts');
const automationsApi = read('app/api/marketing/campaigns/automation/route.ts');
const lifecycleActions = read('app/dashboard/marketing/campaign-lifecycle-actions.tsx');
const cancellationApi = read('app/api/marketing/campaigns/[campaignId]/cancel/route.ts');
const marketingDispatcher = read('lib/marketing/dispatcher.ts');
const manualCampaignRetirement = read(
  'supabase/migrations/20261111130000_disable_manual_marketing_communications.sql',
);


for (const source of [communication, messages, marketingPage]) {
  assert.match(
    source,
    /redirect\('\/dashboard\/automations'\)/,
    'Retired manual communication routes must redirect to automations.',
  );
}

assert.match(sidebar, /automationItems/);
assert.doesNotMatch(
  sidebar,
  /communicationItems|dashboard\/comunicacao|dashboard\/mensagens|dashboard\/marketing/,
);
assert.doesNotMatch(
  dashboard,
  /dashboard\/(mensagens|marketing)/,
  'Dashboard quick actions must not expose manual messaging or campaigns.',
);
assert.doesNotMatch(
  tools,
  /dashboard\/comunicacao/,
  'Tools overview must not link to the retired communication workspace.',
);
const orderManagement = read('app/dashboard/pos/pedidos/page.tsx');
const clientCards = read('app/dashboard/_components/cards/ClientsListCard.tsx');
const waitlist = read('app/dashboard/espera/page.tsx');
const appointmentDetails = read('components/dashboard/appointment-detail-dialog.tsx');
assert.doesNotMatch(orderManagement, /openEmail|sendEmail|mailto:|Enviar email ao cliente/);
assert.doesNotMatch(clientCards, /wa\.me|mailto:|tel:/);
assert.doesNotMatch(waitlist, /mailto:|tel:/);
assert.equal(appointmentDetails.includes('href={`mailto:'), false);
assert.equal(appointmentDetails.includes('href={`tel:'), false);

assert.match(automationsPage, /MarketingWorkspace initialView="automation"/);
assert.match(workspace, /initialView !== 'automation'/);
assert.match(workspace, /triggerType: 'birthday'/);
const automationSection = workspace.slice(
  workspace.indexOf("{view === 'automation' && ("),
  workspace.indexOf("{initialView !== 'automation' && view === 'performance' && ("),
);
assert.ok(automationSection.length > 0, 'Automation workspace section must exist.');
assert.doesNotMatch(automationSection, /Ações rápidas|Enviar agora/);
assert.doesNotMatch(workspace, /option value="manual"/);
assert.match(campaignsApi, /MANUAL_CAMPAIGNS_DISABLED/);
assert.match(campaignsApi, /trigger_type: 'birthday'/);
assert.doesNotMatch(campaignsApi, /export const PATCH/);
assert.match(campaignsApi, /export const DELETE/);
assert.match(campaignsApi, /\.in\('trigger_type', \['interval', 'event', 'birthday'\]\)/);
assert.match(cancellationApi, /\.in\('trigger_type', \['interval', 'event', 'birthday'\]\)/);
assert.match(lifecycleActions, /campaign\.trigger_type/);
assert.match(automationsPage, /CampaignLifecycleActions/);
assert.match(automationsApi, /in\('trigger_type', \['interval', 'event', 'birthday'\]\)/);
assert.match(
  marketingDispatcher,
  /!\['interval', 'event', 'birthday'\]\.includes\(campaign\.trigger_type\)/,
  'Queued manual campaign recipients must be skipped by the background worker.',
);
assert.match(manualCampaignRetirement, /status = 'skipped'/);
assert.match(manualCampaignRetirement, /active = false/);

for (const path of [
  'app/api/messages/send/route.ts',
  'app/api/messages/status/route.ts',
  'app/api/marketing/campaigns/[campaignId]/send/route.ts',
  'app/api/marketplace/orders/[orderId]/email/route.ts',
]) {
  assert.equal(fs.existsSync(path), false, path + ' must be removed.');
}

for (const route of [
  '/dashboard/qr-code',
  '/dashboard/espera',
  '/dashboard/loyalty',
  '/dashboard/loyalty/points',
  '/dashboard/loyalty/validate',
  '/dashboard/pos',
  '/dashboard/website',
]) {
  assert.ok(tools.includes(route), 'Tools overview must keep ' + route);
}

console.log(
  '[COMMUNICATION_GROWTH_QA] Manual customer messaging and campaign creation are disabled; automatic triggers retain cancellation and cleanup controls.',
);
