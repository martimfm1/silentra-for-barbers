import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'supabase/migrations/20261017130000_platform_support_chat.sql',
  'services/support/support-chat.service.ts',
  'app/api/support/conversations/route.ts',
  'app/api/silentra-admin/support/route.ts',
  'app/api/cron/support-email-notifications/route.ts',
  'app/dashboard/suporte/page.tsx',
  'app/_silentra-admin/support-inbox.tsx',
  'app/_silentra-admin/platform-admin-console.tsx',
  'app/dashboard/_components/DashboardSidebar.tsx',
  'vercel.json',
];

for (const path of requiredFiles) {
  await readFile(path, 'utf8');
}

const migration = await readFile(requiredFiles[0], 'utf8');
assert.match(migration, /alter table public\.support_conversations enable row level security/i);
assert.match(migration, /revoke all on public\.support_messages from anon, authenticated/i);
assert.match(migration, /support_send_message/i);
assert.match(migration, /grant execute on function public\.support_send_message[\s\S]*to service_role/i);
assert.match(migration, /support_email_notifications/i);
assert.match(migration, /unique \(barbershop_id\)/i);

const service = await readFile(requiredFiles[1], 'utf8');
assert.match(service, /getEffectiveSupportPlan/i);
assert.match(service, /supportPriority/i);
assert.match(service, /sendBrevoEmail/i);
assert.match(service, /retryDueSupportEmailNotifications/i);

const customerApi = await readFile(requiredFiles[2], 'utf8');
assert.match(customerApi, /auth\.getUser\(\)/);
assert.match(customerApi, /profile\.role !== 'owner'/);
assert.match(customerApi, /isTrustedSupportOrigin/);
assert.match(customerApi, />= 15/);
assert.match(customerApi, /support_send_message/i);

const adminApi = await readFile(requiredFiles[3], 'utf8');
assert.match(adminApi, /requirePlatformAdmin/);
assert.match(adminApi, /isTrustedSupportOrigin/);
assert.match(adminApi, /support_send_message/i);
assert.match(adminApi, /action === 'read'/);

const worker = await readFile(requiredFiles[4], 'utf8');
assert.match(worker, /CRON_SECRET/);
assert.match(worker, /retryDueSupportEmailNotifications/);

const customerUi = await readFile(requiredFiles[5], 'utf8');
assert.match(customerUi, //api\/support\/conversations/);
assert.match(customerUi, /Enviar mensagem/);

const adminUi = await readFile(requiredFiles[6], 'utf8');
assert.match(adminUi, /planRank\[b\.plan\] - planRank\[a\.plan\]/);
assert.match(adminUi, //api\/silentra-admin\/support/);
assert.match(adminUi, /statusFilter === 'unread'/);

const adminConsole = await readFile(requiredFiles[7], 'utf8');
assert.match(adminConsole, /id: 'support', label: 'Suporte'/);
assert.match(adminConsole, /<SupportInbox \/>/);

const sidebar = await readFile(requiredFiles[8], 'utf8');
assert.match(sidebar, /href: '\/dashboard\/suporte', label: 'Suporte Silentra'/);

const vercel = JSON.parse(await readFile(requiredFiles[9], 'utf8'));
assert.ok(
  vercel.crons.some((cron) => cron.path === '/api/cron/support-email-notifications'),
  'Support notification retry worker must be scheduled',
);

console.log('Support-chat contracts passed.');
