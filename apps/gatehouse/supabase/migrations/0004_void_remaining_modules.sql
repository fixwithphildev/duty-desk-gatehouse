-- Extends the same Void correction pattern from incidents (0003) to the
-- rest of Gatehouse's record types: vehicle access, items book, patrols,
-- and alerts. Same rationale — these are accountability records meant to
-- stay permanent, so mistakes get corrected by voiding with a reason, not
-- by editing or deleting the original entry.

alter table vehicle_logs
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

alter table item_logs
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

alter table patrols
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

alter table alerts
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;
