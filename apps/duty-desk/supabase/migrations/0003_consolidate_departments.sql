-- Optional: consolidating Gatehouse and Maintenance Desk into this project
-- (Duty Desk's) to cut Supabase hosting costs from 3 projects down to 1.
-- Run this in the Duty Desk Supabase project's SQL Editor ONLY when you're
-- ready to execute the consolidation runbook in SETUP.md ("Consolidating to
-- one Supabase project"). This just creates the two destination schemas —
-- the actual data migration is a pg_dump/psql step run from a terminal,
-- documented there, since it copies data out of two other live projects.

create schema if not exists gatehouse;
create schema if not exists maintenance;

comment on schema gatehouse is
  'Gatehouse platform tables, migrated here from its own Supabase project to avoid paying a second organization''s base subscription fee. See SETUP.md.';
comment on schema maintenance is
  'Maintenance Desk platform tables, migrated here from its own Supabase project to avoid paying a second organization''s base subscription fee. See SETUP.md.';
