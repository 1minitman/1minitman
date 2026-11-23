-- 0006 · Let the worker create monthly partitions without holding DDL rights.
--
-- The worker connects as app_worker (data changes only). The `partitions.ensure` job calls
-- ensure_monthly_partitions(), which runs CREATE TABLE. SECURITY DEFINER makes the function run
-- with its owner's rights (the migration role), so the worker gets exactly this one DDL action
-- and nothing else. The search_path is pinned, as every SECURITY DEFINER function must be.
ALTER FUNCTION ensure_monthly_partitions(text, date, int) SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION ensure_monthly_partitions(text, date, int) FROM PUBLIC;
