import postgres from 'postgres';
import * as schema from '../schema';
import { collectTables, lintModels, readCatalogue } from '../schema-lint';

// `pnpm db:lint-schema`: fails when a Drizzle model in src/schema/ names a table or column the
// migrations do not have, or states its type, nullability or default differently [ADM §4].
// Run it after `pnpm db:migrate`. It only reads the system catalogue.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.development first.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const tables = collectTables(schema);
  const findings = lintModels(tables, await readCatalogue(sql));
  if (findings.length > 0) {
    for (const finding of findings) console.error(`schema-lint: ${finding.message}`);
    console.error(`schema-lint: ${findings.length} problem(s) in ${tables.length} model(s)`);
    process.exitCode = 1;
  } else {
    console.log(`schema-lint: ${tables.length} model(s) match the migrated schema`);
  }
} finally {
  await sql.end();
}
