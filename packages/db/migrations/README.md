# Migrations

- `0001_baseline_v3_4.sql` is the full schema v3.4 (221 tables), copied as-is from the dev-ready pack.
- Every later change is the next numbered file. Applied so far: `0006_partition_function_definer.sql` and
  `0007_trx_schema_change_set.sql`, so `0008_...` is the next number. (0002–0005 were design-stage deltas
  already folded into the baseline and are never run here.)
- Expand, then contract. Never edit a file that has been applied; the runner checks checksums.
- Each file runs as one transaction. A new enum value cannot be used in the file that adds it:
  put the `ALTER TYPE ... ADD VALUE` in its own file.
- After a migration: `pnpm db:migrate`, then `pnpm db:roles` (grants follow the schema). The Drizzle models
  in `src/schema/` are hand-curated: `pnpm db:pull` writes reference output to the git-ignored
  `.introspected/` folder and never touches `src/schema/`; copy the tables that changed from there and tidy
  them by hand.
