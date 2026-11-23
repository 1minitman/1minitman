-- LOCAL DEVELOPMENT AND CI ONLY. Login users for the docker-compose database, one per group role,
-- with a throwaway password. Hosted environments create their own logins with real passwords:
--   CREATE ROLE <name> LOGIN PASSWORD '<generated>' IN ROLE app_api;   (and so on)
DO $$
DECLARE
  spec record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('minitman_api', 'app_api', false), ('minitman_admin', 'app_admin_api', true),
      ('minitman_worker', 'app_worker', true), ('minitman_queue', 'app_queue', false)
    ) AS t(login, grp, bypass_rls)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = spec.login) THEN
      -- BYPASSRLS is an attribute of the login itself; it is not inherited from the group.
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L %s IN ROLE %I',
        spec.login, 'minitman', CASE WHEN spec.bypass_rls THEN 'BYPASSRLS' ELSE '' END, spec.grp);
    END IF;
  END LOOP;
END $$;
