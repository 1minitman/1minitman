import { defineConfig } from 'drizzle-kit';

// SQL files in migrations/ are the source of truth (expand-then-contract, never edit an applied file).
// drizzle-kit is used one way only: `pnpm db:pull` reads the live database into .introspected/ (git-ignored),
// a starting point to copy from when a module needs its tables modelled in src/schema/.
export default defineConfig({
  dialect: 'postgresql',
  out: './.introspected',
  dbCredentials: { url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? '' },
  schemaFilter: ['public'],
  extensionsFilters: ['postgis'],
  tablesFilter: ['!schema_migrations', '!*_p20*', '!*_default'],
});
