import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const communication = read('app/dashboard/comunicacao/page.tsx');
const sidebar = read('app/dashboard/_components/DashboardSidebar.tsx');
const tools = read('app/dashboard/ferramentas/page.tsx');
const metadata = read('app/dashboard/ferramentas/layout.tsx');
const pt = read('app/locales/pt-copy.ts');
const en = read('app/locales/en-copy.ts');
const packageJson = read('package.json');

for (const route of [
  '/dashboard/mensagens',
  '/dashboard/marketing',
  '/dashboard/automations',
]) {
  assert.ok(
    communication.includes(route),
    'Communication overview should link to ' + route,
  );
  assert.ok(sidebar.includes(route), 'Sidebar should include ' + route);
}
for (const key of [
  'communicationPage.title',
  'communicationPage.description',
  'communicationPage.privacyNote',
  '/api/messages/status',
  '/api/notifications/push',
  '/api/marketing/campaigns',
]) {
  assert.ok(
    communication.includes(key),
    'Communication workspace should use ' + key,
  );
}
const messages = read('app/dashboard/mensagens/page.tsx');
const marketing = read('app/dashboard/marketing/marketing-workspace.tsx');
const messageStatus = read('app/api/messages/status/route.ts');
assert.ok(
  messages.includes('client-search'),
  'Direct messages should support finding a client quickly',
);
assert.ok(
  !messages.includes('copy.smsDescription'),
  'Do not show an inactive SMS composer',
);
assert.ok(
  !messages.includes('copy.birthdayAutomation'),
  'Birthday automation should have one home',
);
assert.ok(
  marketing.includes("campaign.channel === 'email'"),
  'Only supported email campaigns should be editable',
);
assert.ok(
  !marketing.includes('<option value="sms"'),
  'Do not offer SMS as a new campaign channel',
);
assert.ok(
  marketing.includes("campaign.channel === 'sms' || sendingId === campaign.id"),
  'Legacy SMS campaigns must not be sent from the UI',
);
assert.ok(
  messageStatus.includes('contactsWithEmail'),
  'Communication overview should show usable email audience size',
);
assert.ok(
  communication.includes('hasFeature(workflow.feature)'),
  'Communication tools must respect plan access',
);
assert.ok(
  communication.includes('FeaturePlanBadge'),
  'Communication feature badges must remain visible',
);

for (const route of [
  '/dashboard/qr-code',
  '/dashboard/espera',
  '/dashboard/loyalty',
  '/dashboard/loyalty/points',
  '/dashboard/loyalty/validate',
  '/dashboard/pos',
  '/dashboard/website',
]) {
  assert.ok(tools.includes(route), 'Tools overview should link to ' + route);
  assert.ok(sidebar.includes(route), 'Sidebar should include ' + route);
}
assert.ok(
  sidebar.includes('/dashboard/ferramentas'),
  'Sidebar should expose the tools overview',
);
assert.ok(
  sidebar.includes('customerExperienceItems'),
  'Sidebar should group customer experience tools',
);
assert.ok(
  sidebar.includes('businessGrowthItems'),
  'Sidebar should group sales and online presence tools',
);
assert.ok(
  tools.includes('hasFeature(tool.feature)'),
  'Tool cards must respect plan access',
);
assert.ok(
  tools.includes("href={locked ? '/dashboard/billing' : tool.href}"),
  'Locked tools must route to plans',
);
assert.ok(
  tools.includes('secondaryLinks'),
  'Loyalty shortcuts should remain grouped with the loyalty tool',
);
assert.ok(metadata.includes("title: 'Ferramentas e crescimento'"));
assert.ok(
  sidebar.includes("label: 'Visão geral'"),
  'PT navigation should contain a localized overview label',
);
assert.ok(
  sidebar.includes("'Visão geral': 'Overview'"),
  'EN navigation should contain a localized overview label',
);
assert.ok(
  packageJson.includes('qa:communication-growth'),
  'The new contracts must be part of the QA pipeline',
);

console.log(
  '[COMMUNICATION_GROWTH_QA] Communication and tools navigation, feature access and bilingual overview contracts passed.',
);
