import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file) => readFile(file, 'utf8');

async function collectPages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectPages(fullPath);
    return entry.isFile() && /^page\\.(tsx|jsx)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

const [rootLayout, responsiveCss, globalsCss, packageJson, workflow] = await Promise.all([
  read('app/layout.tsx'),
  read('app/silentra-responsive.css'),
  read('app/globals.css'),
  read('package.json'),
  read('.github/workflows/ci.yml'),
]);

// The responsive guard must be imported by the root App Router layout so it
// applies to every public, authenticated and administrative route.
assert.match(rootLayout, /import ['"]\.\/silentra-responsive\.css['"]/);
assert.match(rootLayout, /<ClientShell>\{children\}<\/ClientShell>/);

// Root viewport protection is a safety net; inner sizing rules prevent the
// actual flex/grid/table/dialog children from forcing their parents wider.
assert.match(responsiveCss, /html,\s*body\s*\{[\s\S]*?inline-size:\s*100%;[\s\S]*?overflow-x:\s*clip;/);
assert.match(responsiveCss, /:where\(\.flex, \.grid, \[class\*='flex-'\], \[class\*='grid-'\]\) > \*\s*\{\s*min-inline-size:\s*0;/);
assert.match(responsiveCss, /\.silentra-page-content/);
assert.match(responsiveCss, /\.silentra-dashboard-main/);
assert.match(responsiveCss, /\[data-slot='dialog-content'\]/);
assert.match(responsiveCss, /\[data-slot='table-container'\]/);
assert.match(responsiveCss, /overflow-wrap:\s*anywhere/);
assert.match(responsiveCss, /@media \(max-width: 767px\)/);
assert.match(responsiveCss, /table-layout:\s*fixed/);
assert.match(responsiveCss, /overflow-x:\s*clip/);
assert.match(globalsCss, /\.dashboard-page/);

// Guard cannot silently fall out of the standard quality command or CI.
assert.equal(packageJson.scripts['qa:overflow'], 'node scripts/qa/horizontal-overflow.mjs');
assert.match(packageJson.scripts.qa, /pnpm qa:overflow/);
assert.match(workflow, /name: Horizontal overflow contracts\s+run: pnpm qa:overflow/);

const pages = await collectPages('app');
assert.ok(pages.length >= 50, `Expected broad App Router coverage, found only ${pages.length} pages.`);
console.log(`Horizontal-overflow contract passed: global guard covers all ${pages.length} App Router pages.`);
