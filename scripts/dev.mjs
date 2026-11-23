#!/usr/bin/env node
// `pnpm dev`: one command for local development.
//   1. makes sure .env.development exists
//   2. starts PostgreSQL + Redis (docker compose) and waits until they are healthy
//   3. applies pending database migrations
//   4. starts every app side by side in Turborepo's terminal UI:
//      API, worker, admin console, billing web app, website and Metro (member app)
//
//   pnpm dev                    everything
//   pnpm dev --core             API + admin + website + Metro
//   pnpm dev --only api,admin   pick apps: api, worker, admin, web, site, mobile
//   pnpm dev --skip-services    do not touch docker (you run the database yourself)
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const APPS = ['api', 'worker', 'admin', 'web', 'site', 'mobile'];
const CORE = ['api', 'admin', 'site', 'mobile'];
const selected =
  option('--only')
    ?.split(',')
    .map((name) => name.trim()) ?? (flag('--core') ? CORE : APPS);
const unknown = selected.filter((name) => !APPS.includes(name));
if (unknown.length > 0) {
  console.error(`Unknown app: ${unknown.join(', ')}. Choose from: ${APPS.join(', ')}`);
  process.exit(1);
}

const say = (message) => console.log(`\x1b[1m[dev]\x1b[0m ${message}`);
const run = (command, commandArgs, { quiet = false } = {}) =>
  spawnSync(command, commandArgs, { cwd: root, stdio: quiet ? 'ignore' : 'inherit' });
const fail = (message) => {
  console.error(`\x1b[1m[dev]\x1b[0m ${message}`);
  process.exit(1);
};

// 1. Environment file
if (!existsSync(`${root}/.env.development`)) {
  copyFileSync(`${root}/.env.example`, `${root}/.env.development`);
  say('Created .env.development from .env.example (local defaults work as they are).');
}

// 2 + 3. Services and schema: needed by the API and the worker only.
const needsServices = selected.some((name) => name === 'api' || name === 'worker');
if (needsServices && !flag('--skip-services')) {
  if (run('docker', ['info'], { quiet: true }).status !== 0) {
    fail('Docker is not running. Start Docker Desktop, then run `pnpm dev` again.');
  }
  say('Starting PostgreSQL and Redis…');
  if (run('docker', ['compose', 'up', '-d', '--wait']).status !== 0) {
    fail('Could not start the local services. Is another program using port 5432 or 6379?');
  }
  say('Applying database migrations…');
  if (run('pnpm', ['--silent', 'db:migrate']).status !== 0)
    fail('Migrations failed. See the error above.');
}

// 4. Apps
say(`Starting: ${selected.join(', ')}`);
say(
  'API http://localhost:4000 (docs: /docs) · admin :5173 · web :5174 · website :4321 · Metro :8081',
);
const turbo = (apps, ui) =>
  spawn(
    'pnpm',
    [
      'exec',
      'turbo',
      'run',
      'dev',
      `--ui=${ui}`,
      ...apps.flatMap((name) => ['--filter', `@1minitman/${name}`]),
    ],
    { cwd: root, stdio: 'inherit' },
  );

// Metro is interactive (press i / a / r), which needs Turborepo's terminal UI and a real terminal.
// When output is piped (CI, scripts) fall back to plain logs and run Metro without key handling.
const children = [];
if (process.stdout.isTTY) {
  children.push(turbo(selected, 'tui'));
} else {
  const others = selected.filter((name) => name !== 'mobile');
  if (others.length > 0) children.push(turbo(others, 'stream'));
  if (selected.includes('mobile')) {
    children.push(
      spawn('pnpm', ['--filter', '@1minitman/mobile', 'dev'], {
        cwd: root,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, CI: '1' },
      }),
    );
  }
}
const stop = (signal) => children.forEach((child) => child.kill(signal));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(signal));
for (const child of children) {
  child.on('exit', (code) => {
    stop('SIGTERM');
    process.exit(code ?? 0);
  });
}
