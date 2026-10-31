import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(join(root, path), 'utf8');

const [
  manifestSource,
  metadata,
  layout,
  registration,
  worker,
  topBar,
  siteNavbar,
  installPage,
  packageJson,
  installButton,
  dialog,
] = await Promise.all([
  read('public/site.webmanifest'),
  read('lib/site-metadata.ts'),
  read('app/layout.tsx'),
  read('components/pwa-registration.tsx'),
  read('public/sw.js'),
  read('app/dashboard/_components/DashboardTopBar.tsx'),
  read('components/site-navbar.tsx'),
  read('app/instalar/page.tsx'),
  read('package.json'),
  read('components/pwa-install-button.tsx'),
  read('components/ui/dialog.tsx'),
]);

const manifest = JSON.parse(manifestSource);
assert.equal(manifest.name, 'Silentra for Barbers');
assert.equal(manifest.start_url, '/dashboard');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.scope, '/');
assert.ok(manifest.icons.some((icon) => icon.src === '/icon-192.png'));
assert.ok(manifest.icons.some((icon) => icon.src === '/icon-512.png'));

for (const icon of manifest.icons) {
  const publicPath = join(root, 'public', icon.src.replace(/^\//, ''));
  await access(publicPath);
}

assert.match(metadata, /manifest:\s*'\/site\.webmanifest'/);
assert.match(metadata, /appleWebApp:\s*\{[\s\S]*?capable:\s*true/);
assert.match(layout, /<PwaRegistration\s*\/>/);
assert.match(registration, /serviceWorker\.register\('\/sw\.js'/);
assert.match(topBar, /PwaInstallButton/);
assert.match(topBar, /PwaInstallButton locale=/);
assert.match(siteNavbar, /PwaInstallButton locale=/);
assert.match(siteNavbar, /href: '\/instalar'/);
assert.match(installPage, /<PwaInstallButton locale=\{locale\} \/>/);
assert.match(installPage, /Adicionar ao ecrã principal/);
assert.match(installPage, /href="\/dashboard"/);
assert.ok(installButton.includes('role="tablist"'));
assert.ok(installButton.includes('isAndroid = /Android/i'));
assert.ok(installButton.includes('Add to Dock'));
assert.ok(dialog.includes('z-[10000]'));
assert.ok(dialog.includes('z-[10001]'));
assert.match(worker, /url\.pathname\.startsWith\('\/_next\/static\/'\)/);
assert.match(worker, /if \(!isStaticAsset && !isPwaAsset\) return/);
assert.match(
  packageJson,
  /"qa:pwa": "node scripts\/qa\/pwa-installability\.mjs"/,
);

console.log(
  '[PWA_INSTALLABILITY_QA] manifest, install guides, modal stacking and safe cache allowlist passed',
);
