import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(file, 'utf8');

const [
  clientsPage,
  clientsCard,
  clientProfile,
  clientsListApi,
  clientDetailApi,
  clientNotesApi,
  clientsService,
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
  read('components/dashboard/client-details-dialog.tsx'),
  read('app/api/crm/clients/route.ts'),
  read('app/api/crm/clients/[clientId]/route.ts'),
  read('app/api/crm/clients/[clientId]/notes/route.ts'),
  read('app/dashboard/_services/clients.service.ts'),
  read('app/state/_hooks/dashboard/useClients.ts'),
  read('supabase/migrations/20261101144257_restore_client_notes_for_customer_database.sql'),
  read('components/ui/dialog.tsx'),
  read('components/ui/sheet.tsx'),
  read('app/barbershops/components/booking-drawer-canonical.tsx'),
  read('app/dashboard/_components/DashboardSidebar.tsx'),
  read('package.json'),
]);

// The standard clients page provides server-side search and pagination.
assert.match(clientsPage, /ClientDetailsDialog/);
assert.match(clientsPage, /CLIENTS_PAGE_SIZE = 50/);
assert.match(clientsPage, /\/api\/crm\/clients/);
assert.match(clientsPage, /Authorization: \`Bearer \$\{session\.access_token\}\`/);
assert.match(clientsPage, /onViewClient/);
assert.match(clientsCard, /onViewClient/);
assert.match(clientsCard, /currentPage/);
assert.match(clientsCard, /totalPages/);
assert.match(clientsCard, /viewProfile/);
assert.match(clientsCard, /min-h-11/);
assert.match(clientsCard, /common\.edit/);
assert.match(clientsCard, /common\.delete/);

// Profile shows customer data, booking history, summary metrics and staff notes.
assert.match(clientProfile, /appointmentHistory/);
assert.match(clientProfile, /internalNotes/);
assert.match(clientProfile, /completedAppointments/);
assert.match(clientProfile, /totalSpent/);
assert.match(clientProfile, /client\.style_notes/);
assert.match(clientProfile, /client\.birth_date/);
assert.match(clientProfile, /async function addNote/);
assert.match(clientProfile, /\/api\/crm\/clients/);

// Search, profile and notes endpoints are scoped to the authenticated tenant.
assert.match(clientsListApi, /requireModuleContext\('clients', 'clients', req\)/);
assert.match(clientsListApi, /\.eq\('barbershop_id', tenant\.barbershopId\)/);
assert.match(clientsListApi, /\.eq\('role', 'client'\)/);
assert.match(clientsListApi, /name_complete\.ilike/);
assert.match(clientsListApi, /email\.ilike/);
assert.match(clientsListApi, /num_phone\.ilike/);
assert.match(clientDetailApi, /requireModuleContext\('clients', 'clients', req\)/);
assert.match(clientDetailApi, /\.eq\('barbershop_id', t\.barbershopId\)/);
assert.match(clientDetailApi, /\.eq\('client_id', clientId\)/);
assert.match(clientDetailApi, /\.from\('appointments'\)/);
assert.match(clientDetailApi, /\.from\('client_notes'\)/);
assert.match(clientNotesApi, /requireModuleContext\('clients', 'clients', req\)/);
assert.match(clientNotesApi, /author_id: tenant\.userId/);
assert.match(clientNotesApi, /\.eq\('barbershop_id', tenant\.barbershopId\)/);
assert.match(clientNotesApi, /allowedKeys: \['content'\]/);

// Client editing persists style notes and retains the tenant-scoped profile data.
assert.match(clientsService, /style_notes\?: string/);
assert.match(clientsHook, /style_notes: editingClient\.style_notes/);

// The migration restores staff-only access to internal notes and enables RLS.
assert.match(migration, /create table if not exists public\.client_notes/i);
assert.match(migration, /alter table public\.client_notes enable row level security/i);
assert.match(migration, /client_notes_tenant_select/);
assert.match(migration, /client_notes_tenant_insert/);
assert.match(migration, /author_id = \(select auth\.uid\(\)\)/);
assert.match(migration, /client\.role = 'client'/);

// Shared dialogs and close controls use readable icons and larger touch targets.
assert.match(dialog, /size-10[\s\S]*?<IconX className="size-5"/);
assert.match(sheet, /size-10[\s\S]*?<IconX className="size-5"/);
assert.match(bookingDrawer, /<X className="size-5" aria-hidden="true" \/>/);
assert.match(dashboardSidebar, /size-10[\s\S]*?<X className="size-5"/);
assert.match(
  packageJson,
  /"qa:client-database": "node scripts\/qa\/client-database\.mjs"/,
);

console.log('[CLIENT_DATABASE_QA] client search, profile history, tenant-scoped notes and close controls passed');
