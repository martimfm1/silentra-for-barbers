import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const featuresPath = path.join(root, 'lib', 'billing', 'plan-features.ts');
const source = fs.readFileSync(featuresPath, 'utf8');
const sidebarSource = fs.readFileSync(
  path.join(root, 'app', 'dashboard', '_components', 'DashboardSidebar.tsx'),
  'utf8',
);
const directoryMigration = fs.readFileSync(
  path.join(
    root,
    'supabase',
    'migrations',
    '20261103202133_directory_visibility_default_free.sql',
  ),
  'utf8',
);

function expect(pattern, message) {
  assert.match(source, pattern, message);
}

expect(
  /\[PLANS\.FREE\]: \{ barbers: 1, locations: 1 \}/,
  'Free deve permitir apenas 1 barbeiro.',
);
expect(
  /\[PLANS\.PRO\]: \{ barbers: 5, locations: 1 \}/,
  'Pro deve ter limite de 5 barbeiros.',
);
expect(
  /\[PLANS\.ENTERPRISE\]: \{ barbers: UNLIMITED, locations: UNLIMITED \}/,
  'Enterprise deve ser ilimitado.',
);
expect(
  /team_management/,
  'Gestão de equipa deve permanecer disponível no sistema de features.',
);
expect(
  /messaging/,
  'Mensagens deve permanecer disponível no sistema de features.',
);
expect(
  /directory_visibility/,
  'A opção de ocultar a barbearia do diretório deve permanecer identificada como feature Pro.',
);
expect(
  /manual_mbway_prepayment/,
  'Pré-pagamento MB WAY deve permanecer como feature Pro.',
);

assert.match(
  source,
  /export function getMinimumPlanForFeature/,
  'Os requisitos mínimos de plano devem ser resolvidos a partir do catálogo central.',
);
assert.doesNotMatch(
  sidebarSource,
  /FeaturePlanBadge/,
  'A navegação deve apresentar apenas secções; as badges pertencem às funcionalidades.',
);
assert.match(
  source,
  /if \(\(FREE_FEATURES as readonly string\[\]\)\.includes\(canonicalFeature\)\) \{\s*return null;/,
  'Funcionalidades gratuitas não devem receber badges de upgrade.',
);
assert.match(
  directoryMigration,
  /alter column is_public_in_directory set default true/i,
  'A presença no diretório deve estar ativa por defeito.',
);
assert.match(
  directoryMigration,
  /if not coalesce\(p_visible, true\) and v_plan not in \('pro', 'enterprise'\)/i,
  'Só Pro e Enterprise podem desligar a visibilidade no diretório.',
);
assert.match(
  directoryMigration,
  /grant execute on function public\.set_barbershop_directory_visibility\(uuid, uuid, boolean\)\s+to authenticated, service_role/i,
  'A atualização autenticada da visibilidade deve continuar permitida.',
);
assert.match(
  directoryMigration,
  /auth\.uid\(\) <> p_actor_user_id/,
  'A RPC da visibilidade deve validar o utilizador autenticado.',
);

console.log('✓ Plan limits, feature badges e directory visibility contracts OK');
