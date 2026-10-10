-- Readiness Board speed: the board, dashboard, front desk page and menu work
-- out each apartment's status on every page load. Until now that read every
-- checklist ever submitted, which grows every day (and stops at 1,000 rows).
-- This view hands back only what the status needs: each apartment's latest
-- Ready and latest Not ready checklist of each type, at most 4 rows per
-- apartment however many records pile up.
--
-- Run once in the Supabase SQL Editor for the Duty Desk project, after 0011
-- and BEFORE deploying the code that reads it. Safe to re-run. It only adds a
-- view and an index; nothing existing is changed or removed.

create or replace view apartment_latest_checklists
with (security_invoker = true) as
select distinct on (lower(c.apartment), c.type, c.overall_ready)
  c.id,
  c.apartment,
  c.type,
  c.overall_ready,
  c.created_at,
  s.display_name as prepared_by_name
from apartment_checklists c
left join staff_accounts s on s.id = c.prepared_by
where c.status = 'submitted' and not c.void
order by lower(c.apartment), c.type, c.overall_ready, c.created_at desc;

-- Only the app's server reads it (with the service key), never the browser.
revoke all on apartment_latest_checklists from anon, authenticated;

create index if not exists apartment_checklists_latest_idx
  on apartment_checklists (lower(apartment), type, overall_ready, created_at desc)
  where status = 'submitted' and not void;

notify pgrst, 'reload schema';
