-- ============================================================================
-- 1. Extension + schema access
--
-- Run this FIRST. Enables the crypto extension (needed for gen_random_uuid in
-- the per-table files) and lets the app roles use the public schema.
-- ============================================================================

create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated, service_role;