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
const manualCampaignSendApi = read('app/api/marketing/campaigns/[campaignId]/send/route.ts');
const marketingConsent = read('lib/marketing/consent.ts');
const marketingEmailTemplate = read('lib/marketing/email-template.ts');
const marketingUnsubscribeApi = read('app/api/marketing/unsubscribe/route.ts');
const crmMarketingPreferenceApi = read('app/api/crm/clients/[clientId]/marketing-preference/route.ts');
const clientDetailsDialog = read('components/dashboard/client-details-dialog.tsx');
const marketingMigration = read('supabase/migrations/20261123010746_manual_marketing_campaigns_and_preferences.sql');
const manualCampaignRetirement = read(
  'supabase/migrations/20261111130000_disable_manual_marketing_communications.sql',
);
const productionOperations = read('docs/PRODUCTION_OPERATIONS.md');


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
  /Ferramentas e crescimento|Tools & growth|toolsOverviewItems|dashboard[/]ferramentas/,
  'The tools and growth overview must not appear in dashboard navigation.',
);
assert.match(sidebar, /Experiência do cliente/);
assert.match(sidebar, /Vendas e presença digital/);
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
assert.doesNotMatch(clientCards, /navigator\.clipboard\.writeText/);
assert.doesNotMatch(waitlist, /mailto:|tel:/);
assert.equal(appointmentDetails.includes('href={`mailto:'), false);
assert.equal(appointmentDetails.includes('href={`tel:'), false);

assert.match(automationsPage, /MarketingWorkspace initialView="automation"/);
assert.match(automationsPage, /title: 'Automações de clientes'/);
assert.match(workspace, /initialView !== 'automation'/);
assert.match(workspace, /Automações de clientes/);
assert.match(workspace, /birthdayAudience/);
assert.match(workspace, /const \[loading, setLoading\] = useState\(true\)/);
assert.match(workspace, /const \[hasLoaded, setHasLoaded\] = useState\(false\)/);
assert.match(workspace, /const \[loadError, setLoadError\] = useState<string \| null>\(null\)/);
assert.match(workspace, /!Array\.isArray\(campaignData\.campaigns\)/);
assert.match(workspace, /!Array\.isArray\(automationData\.campaigns\)/);
assert.match(workspace, /setHasLoaded\(true\)/);
assert.match(workspace, /setLoadError\(message\)/);
assert.match(workspace, /!hasLoaded && loading/);
assert.match(workspace, /!hasLoaded && loadError/);
assert.match(workspace, /loadError && hasLoaded/);
assert.match(workspace, /view === 'automation' && !hasLoaded/);
assert.match(workspace, /view === 'automation' && hasLoaded/);
assert.match(workspace, /Tentar novamente/);
assert.match(workspace, /Aniversários a enviar hoje/);
assert.match(workspace, /birthdaysToday/);
assert.match(workspace, /canManageAutomation/);
assert.match(sidebar, /Automações de clientes/);
assert.match(automationsApi, /birthdayAudience/);
assert.match(automationsApi, /withBirthDate/);
assert.match(automationsApi, /birthdayReady/);
assert.match(workspace, /triggerType: 'birthday'/);
const automationSection = workspace.slice(
  workspace.indexOf("{view === 'automation' && hasLoaded && ("),
  workspace.indexOf("{initialView !== 'automation' && view === 'performance' && ("),
);
assert.ok(automationSection.length > 0, 'Automation workspace section must exist.');
assert.doesNotMatch(automationSection, /Ações rápidas|Enviar agora/);
assert.match(workspace, /triggerType: 'manual'/);
assert.match(workspace, /quota\.monthlyLimit/);
assert.match(workspace, /Audiência autorizada/);
assert.match(campaignsApi, /body\?\.triggerType === 'manual'/);
assert.match(campaignsApi, /trigger_type: 'manual'/);
assert.match(campaignsApi, /trigger_type: 'birthday'/);
assert.match(campaignsApi, /export const PATCH/);
assert.match(campaignsApi, /export const DELETE/);
assert.match(campaignsApi, /marketing_campaign_monthly_usage/);
assert.match(cancellationApi, /\.in\('trigger_type', \['interval', 'event', 'birthday'\]\)/);
assert.match(lifecycleActions, /campaign\.trigger_type/);
assert.match(automationsPage, /CampaignLifecycleActions/);
assert.ok(automationsApi.includes(".in('trigger_type', ['interval', 'event', 'birthday'])"));
assert.ok(manualCampaignSendApi.includes('requireModuleContext'));
assert.ok(manualCampaignSendApi.includes('reserve_marketing_campaign_send'));
assert.ok(manualCampaignSendApi.includes('queueManualCampaignRecipients'));
assert.ok(manualCampaignSendApi.includes('MARKETING_MONTHLY_QUOTA_REACHED'));
assert.ok(marketingDispatcher.includes("!['manual', 'interval', 'event', 'birthday'].includes(campaign.trigger_type)"));
assert.ok(marketingDispatcher.includes('marketing_contact_preferences'));
assert.ok(marketingDispatcher.includes('getMarketingUnsubscribeUrl'));
assert.ok(marketingConsent.includes('email_consent_at'));
assert.ok(marketingConsent.includes('email_unsubscribed_at'));
assert.ok(marketingEmailTemplate.includes('Cancelar subscrição'));
assert.ok(marketingUnsubscribeApi.includes('verifyMarketingUnsubscribeToken'));
assert.ok(crmMarketingPreferenceApi.includes('confirmedByCustomer !== true'));
assert.ok(clientDetailsDialog.includes('Registar autorização'));
assert.ok(clientDetailsDialog.includes('Revogar autorização'));
assert.ok(marketingMigration.includes('marketing_contact_preferences to service_role;'));
assert.ok(marketingMigration.includes('marketing_campaign_monthly_usage to service_role;'));
assert.ok(marketingMigration.includes('security invoker'));
assert.doesNotMatch(marketingMigration, /security definer/);
assert.ok(marketingMigration.includes('claim_birthday_marketing_campaign'));
assert.match(manualCampaignRetirement, /status = 'skipped'/);
assert.match(manualCampaignRetirement, /active = false/);

for (const path of [
  'app/api/messages/send/route.ts',
  'app/api/messages/status/route.ts',
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


assert.ok(productionOperations.includes('20261123010746_manual_marketing_campaigns_and_preferences'));
assert.ok(productionOperations.includes('Não executar um down migration destrutivo'));
assert.ok(productionOperations.includes('SECURITY INVOKER'));
assert.ok(productionOperations.includes('A verificação foi read-only'));

console.log(
  '[COMMUNICATION_GROWTH_QA] Manual email campaigns are plan-gated, tenant-scoped, consent-gated, quota-limited and unsubscribable; legacy general messaging remains retired.',
);
