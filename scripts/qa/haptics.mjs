import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const haptics = read('lib/haptics.ts');
const provider = read('components/haptics-provider.tsx');
const button = read('components/ui/button.tsx');
const clientShell = read('components/client-shell.tsx');
const confirmProvider = read(
  'components/dashboard/dashboard-confirm-provider.tsx',
);
const clientsHook = read('app/state/_hooks/dashboard/useClients.ts');

assert.match(haptics, /typeof navigator === 'undefined'/);
assert.match(haptics, /!\('vibrate' in navigator\)/);
assert.match(haptics, /navigator\.vibrate\(HAPTIC_PATTERNS\[feedback\]\)/);
for (const pattern of ['selection', 'success', 'warning', 'error']) {
  assert.ok(haptics.includes(pattern), `Missing haptic pattern: ${pattern}`);
}
assert.match(provider, /document\.addEventListener\('click'/);
assert.match(button, /haptic\?: HapticFeedback \| false/);
assert.match(button, /data-haptic=\{/);
assert.match(clientShell, /<HapticsProvider>/);
assert.match(confirmProvider, /haptic=\{pending\.destructive \? 'warning' : 'success'\}/);
assert.match(clientsHook, /haptic\('error'\)/);
assert.match(clientsHook, /haptic\('success'\)/);

console.log('Haptics QA passed.');
