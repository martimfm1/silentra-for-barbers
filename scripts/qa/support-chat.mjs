import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const requiredFiles = [
  'supabase/migrations/20261017115827_platform_support_chat.sql',
  'supabase/migrations/20261020173130_support_ticket_workflow.sql',
  'supabase/migrations/20261020173141_support_ticket_quotas_and_history.sql',
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
const ticketMigration = await readFile(requiredFiles[1], 'utf8');
const ticketQuotaMigration = await readFile(requiredFiles[2], 'utf8');
assert.match(
  migration,
  /alter table public\.support_conversations enable row level security/i,
);
assert.match(
  migration,
  /revoke all on public\.support_messages from anon, authenticated/i,
);
assert.match(migration, /support_send_message/i);
assert.match(
  migration,
  /grant execute on function public\.support_send_message[\s\S]*to service_role/i,
);
assert.match(migration, /support_email_notifications/i);
assert.match(migration, /unique \(barbershop_id\)/i);
assert.match(
  ticketMigration,
  /drop constraint if exists support_conversations_barbershop_id_key/i,
);
assert.match(
  ticketMigration,
  /status in \('pending', 'open', 'waiting_customer', 'closed'\)/i,
);
assert.match(ticketMigration, /accepted_at timestamptz/i);
assert.match(ticketMigration, /SUPPORT_TICKET_NOT_ACCEPTED/i);
assert.match(ticketMigration, /SUPPORT_TICKET_CLOSED/i);
assert.match(ticketQuotaMigration, /when 'free' then 1/i);
assert.match(ticketQuotaMigration, /when 'pro' then 2/i);
assert.match(ticketQuotaMigration, /when 'enterprise' then 10/i);
assert.match(ticketQuotaMigration, /pg_advisory_xact_lock/i);
assert.match(ticketQuotaMigration, /closed_unresolved/i);

const supportUnreadCountsMigration = await readFile(
  'supabase/migrations/20261020221127_support_unread_counts_rpc.sql',
  'utf8',
);
assert.match(
  supportUnreadCountsMigration,
  /function public\.support_unread_counts/i,
);
assert.match(
  supportUnreadCountsMigration,
  /group by message\.conversation_id/i,
);
assert.match(
  supportUnreadCountsMigration,
  /grant execute on function public\.support_unread_counts[\s\S]*to service_role/i,
);

const everyMessageMigration = await readFile(
  'supabase/migrations/20261017122241_support_notify_every_message.sql',
  'utf8',
);
assert.match(everyMessageMigration, /Every message has a unique outbox entry/i);
assert.match(
  everyMessageMigration,
  /insert into public\.support_email_notifications/i,
);
assert.doesNotMatch(
  everyMessageMigration,
  /v_unread_count|if\s+v_unread_count\s*=\s*0/i,
);

const service = await readFile(requiredFiles[3], 'utf8');
assert.match(service, /getEffectiveSupportPlan/i);
assert.match(service, /supportPriority/i);
assert.match(service, /sendBrevoEmail/i);
assert.match(
  service,
  /new message was sent in your Silentra support conversation/i,
);
assert.doesNotMatch(service, /if \(messageResult\.data\.read_at\)/);
assert.match(service, /retryDueSupportEmailNotifications/i);

const customerApi = await readFile(requiredFiles[4], 'utf8');
assert.match(customerApi, /auth\.getUser\(\)/);
assert.match(customerApi, /profile\.role !== 'owner'/);
assert.match(customerApi, /isTrustedSupportOrigin/);
assert.match(customerApi, />= 15/);
assert.match(customerApi, /support_send_message/i);

const adminApi = await readFile(requiredFiles[5], 'utf8');
assert.match(adminApi, /requirePlatformAdmin/);
assert.match(adminApi, /isTrustedSupportOrigin/);
assert.match(adminApi, /support_send_message/i);
assert.match(adminApi, /action === 'read'/);
assert.match(adminApi, /action === 'accept'/);
assert.match(adminApi, /SUPPORT_TICKET_LIMIT_REACHED/);
assert.match(
  adminApi,
  /SUPPORT_TICKET_NOT_ACCEPTED|Aceita o ticket antes de responder/,
);
assert.match(adminApi, /support_unread_counts/i);
assert.doesNotMatch(adminApi, /normalizedConversations = await Promise\.all/);

const worker = await readFile(requiredFiles[6], 'utf8');
assert.match(worker, /CRON_SECRET/);
assert.match(worker, /retryDueSupportEmailNotifications/);

const customerUi = await readFile(requiredFiles[7], 'utf8');
assert.match(customerUi, /\/api\/support\/conversations/);
assert.match(customerUi, /Enviar mensagem/);
assert.match(customerUi, /create_ticket/);
assert.match(
  customerUi,
  /type FeedbackCategory = 'problem' \| 'suggestion' \| 'feedback'/,
);
assert.match(customerUi, /support-ticket-category/);
assert.match(customerUi, /Reportar um problema/);
assert.match(customerUi, /Sugerir uma melhoria/);
assert.match(customerUi, /Partilhar feedback geral/);
assert.match(customerUi, /subjectPrefix/);
assert.match(customerUi, /\[Problema\]/);
assert.match(customerUi, /\[Sugestão\]/);
assert.match(customerUi, /À espera de aceitação/);
assert.match(customerUi, /Tickets ativos/);
assert.match(customerUi, /Histórico/);
assert.match(customerUi, /maxOpenTickets/);
assert.match(customerUi, /Fechado sem resolução/);
assert.doesNotMatch(customerUi, /setInterval\(/);

const adminUi = await readFile(requiredFiles[8], 'utf8');
assert.match(adminUi, /planRank\[b\.plan\] - planRank\[a\.plan\]/);
assert.ok(adminUi.includes('/api/silentra-admin/support'));
assert.match(adminUi, /statusFilter === 'unread'/);
assert.match(adminUi, /acceptTicket/);
assert.match(adminUi, /selected.status === 'pending'/);
assert.match(adminUi, /Aceitar ticket/);
assert.match(adminUi, /Fechado sem resolução/);
assert.doesNotMatch(adminUi, /setInterval\(/);

const adminConsole = await readFile(requiredFiles[9], 'utf8');
assert.match(adminConsole, /id: 'support', label: 'Suporte'/);
assert.match(adminConsole, /<SupportInbox \/>/);

const sidebar = await readFile(requiredFiles[10], 'utf8');
assert.match(
  sidebar,
  /href: '\/dashboard\/suporte', label: 'Suporte Silentra'/,
);

const vercel = JSON.parse(await readFile(requiredFiles[11], 'utf8'));
assert.ok(
  vercel.crons.some(
    (cron) => cron.path === '/api/cron/support-email-notifications',
  ),
  'Support notification retry worker must be scheduled',
);

console.log('Support-chat contracts passed.');
