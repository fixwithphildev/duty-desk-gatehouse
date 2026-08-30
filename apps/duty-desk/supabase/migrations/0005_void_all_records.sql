-- Extends the Void correction pattern (see 0004's handover-ack comment and
-- Gatehouse's 0003/0004) to every remaining Duty Desk record type:
-- complaints, maintenance tickets, checklists, duty log entries, resident
-- profiles, and tasks. Same rationale throughout — these are accountability
-- records meant to stay permanent, so mistakes get corrected by voiding
-- with a reason, not by editing or deleting the original entry.

alter table complaints
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

-- maintenance_tickets is the one exception: voided_by is plain text, not a
-- staff_accounts foreign key. This table is shared with Maintenance Desk's
-- separate Supabase project via a direct connection — a Maintenance Desk
-- staffer has no row in Duty Desk's staff_accounts to reference, the same
-- reason logged_by_name is already text instead of a FK.
alter table maintenance_tickets
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by_name text,
  add column if not exists voided_at timestamptz;

alter table apartment_checklists
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

alter table duty_log_entries
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

alter table resident_profiles
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

alter table tasks
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;
