import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const workspaceConfig = readFileSync('pnpm-workspace.yaml', 'utf8');
const auditSection = workspaceConfig.match(/^audit:\s*\n((?:[ \t]+.*\n?)*)/m)?.[1] ?? '';
const ignoredAdvisories = [...auditSection.matchAll(/^\s+-\s+(GHSA-[A-Z0-9-]+)\s*$/gm)]
  .map((match) => match[1]);
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
