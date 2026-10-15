import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOTS = ['app', 'components', 'context'];
const EXTENSIONS = new Set(['.tsx', '.jsx']);

// Terms that should not appear in ordinary user-facing UI copy.
const FORBIDDEN = [
  /\bRPC\b/i,
  /\bendpoint\b/i,
  /\bpayload\b/i,
  /\btenant\b/i,
  /\bwebhook\b/i,
  /\bUUID\b/i,
  /\bstatus code\b/i,
  /\bcron job\b/i,
  /\bdeploy(?:ment)?\b/i,
  /\binfrastructure\b/i,
  /\bhigh-fidelity\b/i,
  /\bfrictionless\b/i,
  /\bcommand center\b/i,
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(filePath)));
    else if (EXTENSIONS.has(extname(entry.name))) files.push(filePath);
  }

  return files;
}

const files = [];
for (const root of ROOTS) files.push(...(await walk(root)));

const findings = [];
for (const file of files) {
  const normalizedPath = `/${relative('.', file).replaceAll('\\', '/')}`;

  // Translation sources, shared implementation primitives and private admin
  // consoles are reviewed separately from customer-facing product copy.
  if (
    normalizedPath.includes('/documentation/') ||
    normalizedPath.includes('/locales/') ||
    normalizedPath.includes('/silentra-admin/') ||
    normalizedPath.includes('/_silentra-admin/') ||
    normalizedPath.includes('/components/ui/')
  ) {
    continue;
  }

  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(['"`])([\s\S]*?)\1/g)) {
    const value = match[2].trim();
    if (value.length < 4 || !/[A-Za-zÀ-ÿ]/.test(value)) continue;

    const lineStart = source.lastIndexOf('\n', match.index - 1) + 1;
    const linePrefix = source.slice(lineStart, match.index).trim();

    // This audit targets copy, not implementation details. Ignore imports,
    // assignments, runtime expressions, URLs and common JSX/config attributes.
    if (/^(import|export)\b/.test(linePrefix)) continue;
    if (/^(const|let|var|return|throw|case)\b/.test(linePrefix)) continue;
    if (/^[@$A-Za-z_][\w$]*\s*=/.test(linePrefix)) continue;
    if (/\$\{|=>|encodeURIComponent\(|https?:\/\//.test(value)) continue;
    if (/^[@~./]/.test(value)) continue;
    if (
      /\b(className|id|key|href|src|type|name|value|variant|format|endpoint)\s*=/.test(
        linePrefix,
      )
    )
      continue;

    const rule = FORBIDDEN.find((pattern) => pattern.test(value));
    if (!rule) continue;

    const line = source.slice(0, match.index).split('\n').length;
    findings.push(`${normalizedPath}:${line}: ${value}`);
  }
}

if (findings.length) {
  console.error(
    'UI copy audit found technical language in user-facing source:',
  );
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'UI copy audit passed: no blocked technical language found in user-facing source.',
);
