-- PostgREST authenticator role (Supabase-style)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'homeassistant';
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT USAGE ON SCHEMA public TO authenticator;
