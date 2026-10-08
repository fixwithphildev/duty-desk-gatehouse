-- Duty Desk redesign (Operations Suite): notes on flagged checklist items,
-- guest check-in / check-out records, and problems that stop an apartment
-- being sold. Run once in the Supabase SQL Editor for the duty-desk project,
-- AFTER 0006 and BEFORE deploying the redesign. Safe to re-run. It only adds
-- things; nothing existing is changed or removed.

-- What's wrong with a flagged item ("door hinge broken"). It goes on the
-- maintenance ticket the item opens.
alter table checklist_items
  add column if not exists note text;

-- A resident profile is also the record of one stay: recorded checked in from
-- the Readiness Board (the apartment then shows Occupied), and checked out
-- with the time, keys and any damage to charge the guest (the apartment then
-- needs a check-in prep). Profiles added by hand without a check-in don't
-- make an apartment Occupied.
alter table resident_profiles
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references staff_accounts(id),
  add column if not exists checked_out_at timestamptz,
  add column if not exists checked_out_by uuid references staff_accounts(id),
  add column if not exists keys_returned text,          -- 'Yes' | 'Partly' | 'No'
  add column if not exists damage jsonb,                -- [{ "item": "...", "charge": 15000 }]
  add column if not exists checkout_notes text;

create index if not exists resident_profiles_staying_idx
  on resident_profiles (lower(room))
  where checked_in_at is not null and checked_out_at is null;

-- A problem reported on an apartment can stop front desk selling it until
-- it's fixed and a new check-in prep is submitted Ready.
alter table maintenance_tickets
  add column if not exists blocks_sale boolean not null default false;

-- Complaints: which team is handling it, the note left when it's resolved,
-- the repair ticket it opened (if something was broken), and when it moved
-- along, for the complaint's activity timeline.
alter table complaints
  add column if not exists assigned_to text not null default 'Resident Officers',
  add column if not exists resolution_note text,
  add column if not exists ticket_id uuid references maintenance_tickets(id),
  add column if not exists in_progress_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references staff_accounts(id);
