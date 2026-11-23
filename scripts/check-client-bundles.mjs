// Fails if anything server-only ended up in a browser bundle. Run after `pnpm build`.
// Two checks over apps/{admin,web,site}/dist:
//   1. the NAME of a server-only variable (anything in .env.example without a client prefix)
//   2. the VALUE of one, taken from the current environment and .env.development if present
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CLIENT_PREFIXES = ['VITE_', 'PUBLIC_', 'EXPO_PUBLIC_'];
// Not secret and common enough as plain words to cause false alarms.
const HARMLESS = new Set([
  'APP_ENV',
  'APP_VERSION',
  'LOG_LEVEL',
  'API_PORT',
  'EMAIL_FROM',
  'POSTHOG_HOST',
  'AWS_REGION',
]);

const parse = (file) =>
  Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
      .filter(Boolean)
      .map(([, name, value]) => [name, value.replace(/^"|"$/g, '')]),
  );

const declared = parse(join(root, '.env.example'));
const serverNames = Object.keys(declared).filter(
  (name) => !CLIENT_PREFIXES.some((prefix) => name.startsWith(prefix)) && !HARMLESS.has(name),
);
const local = existsSync(join(root, '.env.development'))
  ? parse(join(root, '.env.development'))
  : {};
const serverValues = serverNames
  .map((name) => [name, process.env[name] ?? local[name] ?? ''])
  .filter(([, value]) => value.length >= 12);

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const problems = [];
let scanned = 0;
for (const app of ['admin', 'web', 'site']) {
  const dist = join(root, 'apps', app, 'dist');
  if (!existsSync(dist)) {
    console.error(`apps/${app}/dist is missing. Run \`pnpm build\` first.`);
    process.exit(1);
  }
  for (const file of walk(dist).filter((path) => /\.(js|mjs|html|css|json|map)$/.test(path))) {
    const text = readFileSync(file, 'utf8');
    scanned += 1;
    for (const name of serverNames) {
      if (text.includes(name))
        problems.push(`${file.slice(root.length)}: mentions server-only variable ${name}`);
    }
    for (const [name, value] of serverValues) {
      if (text.includes(value))
        problems.push(`${file.slice(root.length)}: contains the VALUE of ${name}`);
    }
  }
}
if (problems.length > 0) {
  console.error(
    `Server-only settings found in client bundles:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log(
  `client-bundles: ${scanned} files clean (${serverNames.length} server-only names checked)`,
);
