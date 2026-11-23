# Migrations

- `0001_baseline_v3_4.sql` is the full schema v3.4 (221 tables), copied as-is from the dev-ready pack.
- Every later change is the next numbered file (`0006_...` is the next number: 0002–0005 were design-stage
  deltas already folded into the baseline and are never run here).
- Expand, then contract. Never edit a file that has been applied; the runner checks checksums.
- Each file runs as one transaction. A new enum value cannot be used in the file that adds it:
  put the `ALTER TYPE ... ADD VALUE` in its own file.
- After a migration: `pnpm db:migrate`, then `pnpm db:pull` to refresh the Drizzle models in `src/schema/`.
