#!/usr/bin/env node
// `pnpm preflight`: checks that this machine can run the project. Reads only; changes nothing.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = (command, args) => spawnSync(command, args, { encoding: 'utf8' });
const results = [];
const check = (name, ok, hint) => results.push({ name, ok, hint });

const [major, minor] = process.versions.node.split('.').map(Number);
check(
  `Node ${process.versions.node}`,
  major > 22 || (major === 22 && minor >= 23),
  'Install Node 22.23 or newer (nvm install 22).',
);

const pnpm = out('pnpm', ['--version']);
check(
  `pnpm ${pnpm.stdout?.trim() || 'missing'}`,
  pnpm.status === 0 && Number(pnpm.stdout.split('.')[0]) >= 10,
  'Run: corepack enable && corepack prepare pnpm@10 --activate',
);

check(
  'Docker is running',
  out('docker', ['info']).status === 0,
  'Start Docker Desktop (needed for the local database and Redis).',
);
check('node_modules installed', existsSync(`${root}/node_modules/.bin/turbo`), 'Run: pnpm install');
check(
  '.env.development exists',
  existsSync(`${root}/.env.development`),
  'Run: cp .env.example .env.development',
);

const portFree = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
for (const [port, app] of [
  [4000, 'API'],
  [5173, 'admin'],
  [5174, 'web app'],
  [4321, 'website'],
  [8081, 'Metro'],
]) {
  check(
    `Port ${port} free (${app})`,
    await portFree(port),
    `Something is already using port ${port}. Stop it, or stop a previous \`pnpm dev\`.`,
  );
}

for (const { name, ok, hint } of results)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    → ${hint}`}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
