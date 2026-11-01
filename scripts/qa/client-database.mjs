import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(file, 'utf8');

const [
  clientsPage,
  clientsCard,
  profileDialog,
  clientsService,
  appointmentsService,
  clientsHook,
  migration,
  dialog,
  sheet,
  bookingDrawer,
  dashboardSidebar,
  packageJson,
] = await Promise.all([
  read('app/dashboard/clientes/page.tsx'),
  read('app/dashboard/_components/cards/ClientsListCard.tsx'),
  read('app/dashboard/_components/ClientProfileDialog.tsx'),
  read('app/dashboard/_services/clients.service.ts'),
  read('app/dashboard/_services/appointments.service.ts'),
  read('app/state/_hooks/dashboard/useClients.ts'),
  read('supabase/migrations/20261101144257_restore_client_notes_for_customer_database.sql'),
  read('components/ui/dialog.tsx'),
  read('components/ui/sheet.tsx'),
  read('app/barbershops/components/booking-drawer-canonical.tsx'),
  read('app/dashboard/_components/DashboardSidebar.tsx'),
  read('package.json'),
]);

// The standard clients page remains available without the advanced CRM entitlement.
assert.match(clientsPage, /<ClientProfileDialog/);
assert.match(clientsPage, /onSelectClient=\{setSelectedClient\}/);
assert.match(clientsPage, /client\.name_complete/);
assert.match(clientsPage, /client\.num_phone/);
assert.match(clientsPage, /client\.email/);
assert.match(clientsPage, /client\.style_notes/);
assert.match(clientsCard, /onSelectClient/);
assert.match(clientsCard, /viewProfile/);
assert.match(clientsCard, /min-h-11/);
assert.match(clientsCard, /editAction/);
assert.match(clientsCard, /deleteAction/);
assert.match(clientsPage, /edit-client-email/);
assert.match(clientsPage, /edit-client-style-notes/);
assert.match(clientsHook, /style_notes: editingClient\.style_notes/);

// Profile details, history and internal notes are visible and tenant-scoped.
assert.match(profileDialog, /appointmentHistory/);
assert.match(profileDialog, /internalNotes/);
assert.match(profileDialog, /clientDetails/);
assert.match(profileDialog, /preferences/);
assert.match(profileDialog, /onEdit\(client\)/);
assert.match(appointmentsService, /async getClientHistory/);
assert.match(appointmentsService, /\.eq\('barbershop_id', barbershopId\)/);
assert.match(appointmentsService, /\.eq\('client_id', clientId\)/);
assert.match(clientsService, /async getClientNotes/);
assert.match(clientsService, /async addClientNote/);
assert.match(clientsService, /author_id: user\.id/);
assert.match(migration, /alter table public\.client_notes enable row level security/i);
assert.match(migration, /grant select, insert on table public\.client_notes to authenticated/i);
assert.match(migration, /client_notes_tenant_select/);
assert.match(migration, /client_notes_tenant_insert/);
assert.match(migration, /author_id = \(select auth\.uid\(\)\)/);
assert.match(migration, /client\.role = 'client'/);

// Shared close controls and custom drawer close buttons use a visible 44px target
// and a larger X glyph; clear-search icons are intentionally not treated as close controls.
assert.match(dialog, /size-11[\s\S]*?<IconX className="size-5"/);
assert.match(sheet, /size-11[\s\S]*?<IconX className="size-5"/);
assert.match(bookingDrawer, /<X className="size-5" aria-hidden="true" \/>/);
assert.match(dashboardSidebar, /size-11[\s\S]*?<X className="size-5"/);

assert.match(
  packageJson,
  /"qa:client-database": "node scripts\/qa\/client-database\.mjs"/,
);
console.log('[CLIENT_DATABASE_QA] client search, profile history, tenant notes and close controls passed');
