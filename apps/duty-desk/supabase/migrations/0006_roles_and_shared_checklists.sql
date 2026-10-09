-- Duty Desk: Resident Manager and Supervisor roles, and check-in preps that
-- are saved as you go instead of only on submit.
-- Run once in the Supabase SQL Editor for the duty-desk project, BEFORE
-- deploying the code that uses it. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. New roles. Added alongside the existing ones (nothing is removed).
--    Resident Manager: runs Duty Desk and manages staff accounts.
--    Supervisor: does everything a Resident Officer does and can see the
--    staff list, but can't change accounts.
-- ---------------------------------------------------------------------------
alter type dd_role add value if not exists 'resident_manager';
alter type dd_role add value if not exists 'supervisor';

-- ---------------------------------------------------------------------------
-- 2. Checklists in progress.
--    A checklist now starts as status 'in_progress' and its answers are saved
--    as the officer goes, so everyone can see who is inspecting which
--    apartment and nothing is lost if a phone dies. It becomes 'submitted'
--    (and locked) when the officer submits it.
--    created_at keeps meaning "when it was submitted" for submitted
--    checklists, so every existing report and alert keeps working; the
--    start time of the inspection goes in started_at.
-- ---------------------------------------------------------------------------
alter table apartment_checklists
  add column if not exists started_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists draft_ready boolean,
  add column if not exists taken_over_from uuid references staff_accounts(id),
  add column if not exists taken_over_at timestamptz;

-- Only one inspection in progress per apartment at a time, enforced by the
-- database itself, so two officers tapping Start at the same moment can't
-- both get one.
create unique index if not exists apartment_checklists_one_in_progress
  on apartment_checklists (lower(trim(apartment)))
  where status = 'in_progress' and void = false;

-- Lets each answer be saved (and changed) individually while in progress.
create unique index if not exists checklist_items_checklist_name_unique
  on checklist_items (checklist_id, name);
