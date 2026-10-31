import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const featuresPath = path.join(root, 'lib', 'billing', 'plan-features.ts');
const source = fs.readFileSync(featuresPath, 'utf8');

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
  'Visibilidade no diretório deve permanecer identificada como feature Pro.',
);
expect(
  /manual_mbway_prepayment/,
  'Pré-pagamento MB WAY deve permanecer como feature Pro.',
);

console.log('✓ Plan limits e feature contracts OK');
