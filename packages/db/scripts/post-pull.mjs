// Runs after `drizzle-kit pull`. The output in .introspected/ is reference material only:
// copy the tables a module needs into src/schema/<domain>.ts and tidy them there.
// Known generator slips repaired here: empty-string defaults, and columns typed with a
// schema DOMAIN (app_locale, e164, iso_country, ...) which come out as unknown().
// Not repaired: partitioned parents (messages, group_messages, ...) are skipped by the
// generator and PostGIS columns need the custom types in src/schema/types.ts.
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const dir = new URL('../.introspected/', import.meta.url);
const file = new URL('schema.ts', dir);
const source = readFileSync(file, 'utf8')
  .replace(/\.default\('\)/g, ".default('')")
  .replace(/unknown\(/g, 'text(');
writeFileSync(file, source);

rmSync(new URL('meta/', dir), { recursive: true, force: true });
for (const name of readdirSync(dir)) if (name.endsWith('.sql')) rmSync(new URL(name, dir));
console.log('Reference models written to packages/db/.introspected/ (not committed).');
