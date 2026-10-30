import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [dashboard, editor, api, migration, grantsMigration] = await Promise.all([
  readFile('app/dashboard/page.tsx', 'utf8'),
  readFile('app/dashboard/_components/DashboardCustomization.tsx', 'utf8'),
  readFile('app/api/dashboard/customizations/route.ts', 'utf8'),
  readFile('supabase/migrations/20261030120000_dashboard_customizations.sql', 'utf8'),
]);

// Dashboard renders only the selected shortcuts and independently toggleable sections.
assert.match(dashboard, /useDashboardCustomization/);
assert.match(dashboard, /customization\.config\.shortcuts/);
assert.match(dashboard, /customization\.config\.sections\.quickActions/);
assert.match(dashboard, /customization\.config\.sections\.metrics/);
assert.match(dashboard, /customization\.config\.sections\.activityChart/);
assert.match(dashboard, /customization\.config\.sections\.upcomingAppointments/);
assert.match(dashboard, /--dashboard-accent/);
assert.match(dashboard, /DashboardCustomizationDialog/);
for (const id of ['new-booking', 'clients', 'services', 'team', 'analytics', 'loyalty', 'qr-code', 'automations', 'messages', 'marketing', 'sales', 'website', 'support']) {
  assert.ok(dashboard.includes(`id: '${id}'`), `Missing shortcut ${id}`);
}

// Presets have stable UUIDs, are isolated per user + tenant, and use a validated config.
assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/);
assert.match(migration, /barbershop_id uuid not null references public\.barbershops/);
assert.match(migration, /user_id uuid not null references public\.users/);
assert.match(migration, /enable row level security/i);
assert.match(migration, /grant select, insert, update, delete on public\.barbershop_dashboard_customizations to authenticated/i);
assert.match(migration, /grant all on public\.barbershop_dashboard_customizations to service_role/i);
assert.match(migration, /where is_active = true/i);
assert.match(migration, /on conflict \(barbershop_id, user_id, \(lower\(name\)\)\) do nothing/i);

// Server validates session, tenant, role, CSRF origin, preset ownership and allowed fields.
assert.match(api, /supabase\.auth\.getUser\(\)/);
assert.match(api, /profile\.barbershop_id/);
assert.match(api, /client', 'customer/);
assert.match(api, /assertSameOrigin\(request\)/);
assert.match(api, /SHORTCUT_IDS/);
assert.match(api, /SECTION_IDS/);
assert.match(api, /COLOR_PATTERN/);
assert.match(api, /\.eq\('barbershop_id', context\.barbershopId\)/);
assert.match(api, /\.eq\('user_id', context\.user\.id\)/);
assert.match(api, /Podes guardar até 10 personalizações/);
assert.match(api, /Mantém pelo menos uma personalização/);
assert.match(editor, /useDashboardCustomization/);
assert.match(editor, /Guardar alterações/);
assert.match(editor, /Cor dos detalhes/);
assert.match(editor, /Move up/);
assert.match(editor, /Move down/);
assert.match(editor, /__new__/);

console.log('Dashboard customization contracts passed.');
