-- Dual-database bootstrap for Petko on HA Postgres 17
-- Run as postgres superuser (once per cluster + once per database)

-- 1) Cluster roles (run on postgres DB)
\i ha-postgres-init-authenticator.sql
\i ha-postgres-init-anon.sql

-- 2) Create databases
CREATE DATABASE petko_en;
CREATE DATABASE petko_sr;

-- 3) Load EN schema (connect to petko_en)
\c petko_en
\i ../supabase-schema.sql

-- 4) Load SR schema (connect to petko_sr)
\c petko_sr
\i ../../petko/github/supabase-schema.sql
\i ../../petko/github/supabase-lector-stats.sql
\i ../../petko/github/sql/2026-08-03-weekend-results.sql

-- 5) Grants (run on each DB after schema load)
GRANT CONNECT ON DATABASE petko_en TO anon;
GRANT CONNECT ON DATABASE petko_sr TO anon;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
