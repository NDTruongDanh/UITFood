-- Automatically create the dedicated E2E / integration-test database
-- when the PostgreSQL container is first initialised.
--
-- This script runs once via /docker-entrypoint-initdb.d/ and is idempotent:
-- the SELECT guard prevents an error if the database already exists.

SELECT 'CREATE DATABASE food_order_test'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'food_order_test'
)\gexec

-- Use a non-superuser credential for the legacy API in local Compose so the
-- Media database isolation can be exercised rather than bypassed by Postgres.
SELECT 'CREATE ROLE uitfood_api LOGIN PASSWORD ''api_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_api'
)\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO uitfood_api', current_database())\gexec
GRANT USAGE, CREATE ON SCHEMA public TO uitfood_api;

-- Phase 3: a separate logical database and credential for the Media service.
-- The legacy API credential is deliberately not granted access.
SELECT 'CREATE ROLE uitfood_media LOGIN PASSWORD ''media_secret'''
WHERE NOT EXISTS (
    SELECT FROM pg_roles WHERE rolname = 'uitfood_media'
)\gexec

SELECT 'CREATE DATABASE uitfood_media OWNER uitfood_media'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'uitfood_media'
)\gexec

REVOKE ALL ON DATABASE uitfood_media FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE uitfood_media TO uitfood_media;

-- Grant the default user full access to the test database.
GRANT ALL PRIVILEGES ON DATABASE food_order_test TO food_order;

-- Install extensions that search and semantic search require in the main DB.
CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;

-- \connect switches context so the extensions are also created inside the test DB.
\connect food_order_test

CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;
