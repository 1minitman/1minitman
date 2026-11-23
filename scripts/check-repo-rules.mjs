// Structural rules that keep the repository safe and tidy. Fast, no dependencies. Run by CI.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const problems = [];
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

// ---- 1. GitHub Actions: zero trust
const workflowDir = join(root, '.github/workflows');
for (const file of readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))) {
  const text = readFileSync(join(workflowDir, file), 'utf8');
  const where = `.github/workflows/${file}`;
  // A tag can be moved to malicious code; a full commit hash cannot.
  for (const [, action, ref] of text.matchAll(/^\s*-?\s*uses:\s*([^\s@]+)@(\S+)/gm)) {
    if (!action.startsWith('./') && !/^[0-9a-f]{40}$/.test(ref)) {
      problems.push(`${where}: "${action}@${ref}" must be pinned to a full commit hash.`);
    }
  }
  // pull_request_target runs with secrets and write access on code from a fork.
  if (
    /^\s*pull_request_target\s*:/m.test(text) ||
    /on:\s*\[?[^\n]*pull_request_target/.test(text)
  ) {
    problems.push(`${where}: pull_request_target is banned.`);
  }
  if (!/^permissions:/m.test(text)) {
    problems.push(`${where}: declare top-level "permissions:" (read-only by default).`);
  }
  if (/^permissions:\s*write-all/m.test(text))
    problems.push(`${where}: "permissions: write-all" is banned.`);
}

// ---- 2. Workspaces: apps deploy, packages are shared, references use workspace:*
const workspaces = ['apps', 'packages'].flatMap((group) =>
  readdirSync(join(root, group))
    .filter((name) => existsSync(join(root, group, name, 'package.json')))
    .map((name) => ({
      group,
      path: `${group}/${name}`,
      manifest: json(`${group}/${name}/package.json`),
    })),
);
const appNames = new Set(workspaces.filter((w) => w.group === 'apps').map((w) => w.manifest.name));
const versions = new Map();

for (const { group, path, manifest } of workspaces) {
  if (!manifest.private)
    problems.push(`${path}: must be "private": true (nothing here is published).`);
  if (group === 'packages' && !manifest.exports) {
    problems.push(`${path}: declare "exports" so only the public surface can be imported.`);
  }
  const sections = ['dependencies', 'devDependencies', 'peerDependencies'];
  for (const section of sections) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      if (name.startsWith('@1minitman/')) {
        if (section !== 'peerDependencies' && range !== 'workspace:*') {
          problems.push(`${path}: ${name} must be "workspace:*" (found "${range}").`);
        }
        if (appNames.has(name))
          problems.push(`${path}: depends on the app ${name}. Apps are never imported.`);
      }
      // Lockstep: these must resolve to one version in every workspace (catalog in pnpm-workspace.yaml).
      if (
        ['react', 'react-dom', 'react-native', 'typescript', 'zod'].includes(name) &&
        section !== 'peerDependencies'
      ) {
        versions.set(name, (versions.get(name) ?? new Set()).add(range));
        if (range !== 'catalog:')
          problems.push(`${path}: ${name} must use "catalog:" (found "${range}").`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Repository rules broken:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`repo-rules: ${workspaces.length} workspaces and the CI workflows are clean`);
