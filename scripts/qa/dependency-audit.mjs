import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const workspaceConfig = readFileSync('pnpm-workspace.yaml', 'utf8');
const lines = workspaceConfig.split(/\r?\n/);
const auditIndex = lines.findIndex((line) => /^audit:[ \t]*$/.test(line));

if (auditIndex < 0) {
  console.error('Dependency audit configuration is missing from pnpm-workspace.yaml.');
  process.exit(1);
}

const auditLines = [];
for (let index = auditIndex + 1; index < lines.length; index += 1) {
  const line = lines[index];
  if (line.trim() && !/^[ \t]+/.test(line)) break;
  auditLines.push(line);
}

const ignoreIndex = auditLines.findIndex((line) => /^  ignore:[ \t]*$/.test(line));
const ignoredAdvisories = [];

if (ignoreIndex >= 0) {
  for (const line of auditLines.slice(ignoreIndex + 1)) {
    if (!line.trim()) continue;
    const indentation = line.match(/^[ \t]*/)?.[0].length ?? 0;
    if (indentation <= 2) break;
    const match = line.match(/^[ \t]+-[ \t]+(GHSA-[A-Za-z0-9-]+)[ \t]*$/);
    ignoredAdvisories.push(match?.[1] ?? `INVALID_ENTRY:${line.trim()}`);
  }
}

const allowedUnfixedAdvisories = ['GHSA-fc5q-39xc-vjpf'];

if (
  ignoredAdvisories.length !== allowedUnfixedAdvisories.length ||
  ignoredAdvisories.some((id) => !allowedUnfixedAdvisories.includes(id))
) {
  console.error(
    'Dependency audit exception list changed. Review every ignored GHSA and update the accepted-risk register before continuing.',
  );
  process.exit(1);
}

const args = ['audit', '--prod', '--audit-level=high'];
console.log(`Running pnpm ${args.join(' ')}`);

try {
  execFileSync('pnpm', args, { stdio: 'inherit' });
} catch {
  console.error(
    'Dependency audit failed. Resolve high/critical production vulnerabilities before release.',
  );
  process.exit(1);
}
