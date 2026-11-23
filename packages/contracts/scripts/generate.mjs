// Turns openapi/{member,public,admin}.json (written by `pnpm --filter @1minitman/api openapi:emit`)
// into TypeScript types in src/generated/.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const surface of ['member', 'public', 'admin']) {
  const input = `openapi/${surface}.json`;
  if (!existsSync(`${root}/${input}`)) {
    console.error(`Missing ${input}. Run: pnpm contracts:generate (from the repo root).`);
    process.exit(1);
  }
  execFileSync('pnpm', ['exec', 'openapi-typescript', input, '-o', `src/generated/${surface}.ts`], {
    cwd: root,
    stdio: 'inherit',
  });
}
