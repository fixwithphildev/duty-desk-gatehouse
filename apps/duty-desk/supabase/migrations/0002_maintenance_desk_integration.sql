-- Adds cross-platform attribution to maintenance_tickets, needed now that a
-- second platform (Maintenance Desk) reads and writes this same table
-- directly — see apps/maintenance-desk/src/lib/supabase.ts for how.
--
-- created_by (existing column) is a hard foreign key into THIS project's
-- own staff_accounts table, so it only ever makes sense for tickets Duty
-- Desk itself creates — it already allows null and nothing needs to
-- change there. Maintenance Desk staff have no row in that table (their
-- identity lives in Maintenance Desk's own, separate Supabase project),
-- so a plain, non-FK text column is what lets either platform record who
-- created or last updated a ticket, regardless of which login system that
-- person authenticated through.
--
-- Run this once in the Supabase SQL Editor for the duty-desk project,
-- AFTER 0001_init.sql.

alter table maintenance_tickets add column if not exists logged_by_name text;

comment on column maintenance_tickets.logged_by_name is
  'Display name of whoever created the ticket or last changed its status, from either Duty Desk or Maintenance Desk. Not a foreign key on purpose — the two platforms have separate staff_accounts tables.';
