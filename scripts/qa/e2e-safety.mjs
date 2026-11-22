import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/isolated-e2e.yml', 'utf8');
const runner = readFileSync('scripts/e2e/booking-tenant-isolation.mjs', 'utf8');
const supabaseConfig = readFileSync('supabase/config.toml', 'utf8');
const planEnumMigration = readFileSync('supabase/migrations/20260815194400_create_subscription_plan_enum.sql', 'utf8');
const professionalUserIdMigration = readFileSync('supabase/migrations/20260821122900_add_professional_user_id.sql', 'utf8');

assert.match(workflow, /workflow_dispatch:/, 'E2E workflow must be manually runnable.');
assert.match(workflow, /pnpm exec supabase start --exclude/, 'E2E workflow must start its own local Supabase stack.');
assert.match(workflow, /pnpm exec supabase status -o env/, 'E2E workflow must source local Supabase credentials.');
assert.match(workflow, /playwright install/, 'E2E workflow must install a browser.');
assert.match(workflow, /pnpm exec supabase stop --no-backup/, 'E2E workflow must discard its local stack.');
assert.match(workflow, /--exclude studio,mailpit,logflare,supavisor,edge-runtime,vector/, 'E2E workflow must use current Supabase container names.');
assert.ok(!supabaseConfig.includes('[local_smtp]'), 'Supabase config must not use the removed local_smtp section.');
assert.ok(supabaseConfig.includes('additional_redirect_urls = ["http://127.0.0.1:3000"]'), 'Local Supabase redirects must match the HTTP loopback app origin.');
assert.match(planEnumMigration, /pg_catalog\.pg_type/, 'The plan enum migration must detect an existing type.');
assert.match(planEnumMigration, /CREATE TYPE public\.subscription_plan AS ENUM/, 'The plan enum migration must create the enum for fresh databases.');
assert.match(planEnumMigration, /'free'.*'pro'.*'enterprise'/s, 'The plan enum must include every supported plan.');
assert.match(professionalUserIdMigration, /ADD COLUMN IF NOT EXISTS user_id uuid/, 'The professional user link must exist before team seat migrations use it.');


assert.match(runner, /assertLoopbackUrl/, 'E2E runner must reject remote targets.');
assert.match(runner, /127\.0\.0\.1/, 'E2E runner must enforce loopback-only services.');
assert.match(runner, /auth\.admin\.createUser/, 'E2E fixtures must be synthetic Auth users.');
assert.match(runner, /auth\.admin\.deleteUser/, 'E2E fixtures must be deleted afterwards.');
assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY/, 'Service role must be read only by the Node test runner.');
assert.match(runner, /\/api\/team\/invite/, 'E2E must exercise the invite API.');
assert.match(runner, /Continuar com convite/, 'E2E must accept invitations in the browser UI.');
assert.match(runner, /\/api\/bookings/, 'E2E must exercise public booking.');
assert.match(runner, /\/api\/appointments\/.*\/activity/, 'E2E must exercise tenant-scoped appointment activity.');
assert.match(runner, /\/api\/appointments\/.*\/reschedule/, 'E2E must exercise rescheduling.');
assert.match(runner, /\/api\/appointments\/.*\/complete/, 'E2E must exercise completion.');
assert.doesNotMatch(runner, /https:\/\/barbers\.silentra\.me/i, 'E2E must never target production.');
assert.doesNotMatch(runner, /page\.evaluate\([^]*SUPABASE_SERVICE_ROLE_KEY/, 'Service-role credentials must never be exposed in browser JavaScript.');

console.log('Isolated authenticated E2E safety contracts passed.');
