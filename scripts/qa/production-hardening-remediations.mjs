import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  'supabase/migrations/20261115153000_fix_production_audit_regressions.sql',
  'utf8',
);

assert.match(
  migration,
  /from public\.users as u[\s\S]*u\.role = 'owner'/i,
  'Invite join must qualify users.role to avoid RETURNS TABLE output-variable ambiguity.',
);
assert.match(
  migration,
  /on conflict on constraint subscription_expiry_reminder_outbox_once do nothing/i,
  'Subscription reminder claiming must use the named unique constraint.',
);
assert.match(
  migration,
  /revoke all on function public\.set_manual_booking_auto_confirmation\(uuid, boolean\)[\s\S]*from public, anon/i,
  'Manual booking settings RPC must not be callable by anon or PUBLIC.',
);
assert.match(
  migration,
  /grant execute on function public\.set_manual_booking_auto_confirmation\(uuid, boolean\)[\s\S]*to authenticated/i,
  'Manual booking settings RPC must remain available to authenticated dashboard users.',
);
assert.match(
  migration,
  /revoke all on function public\.apply_manual_booking_confirmation_setting\(\)[\s\S]*from public, anon, authenticated, service_role/i,
  'Trigger function must not be exposed as a callable API function.',
);
assert.match(
  migration,
  /alter default privileges for role postgres in schema public[\s\S]*revoke execute on functions from public, anon/i,
  'Future public functions created by postgres must not receive PUBLIC/anon EXECUTE by default.',
);
assert.match(
  migration,
  /drop trigger if exists trigger_notify_new_review on public\.reviews/i,
  'The orphaned review notification producer must stop creating queue entries.',
);
assert.doesNotMatch(
  migration,
  /delete from public\.notification_queue|truncate table public\.notification_queue/i,
  'Existing legacy notification rows must be preserved.',
);
console.log('[PRODUCTION_HARDENING_QA] production regression remediation contracts passed.');
