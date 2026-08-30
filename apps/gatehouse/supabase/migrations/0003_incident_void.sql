-- Lets a mistakenly-logged incident be corrected without silently editing
-- or deleting it — accountability records here are meant to be permanent
-- (see the blueprint's rationale for checklists, which applies the same
-- way to incidents). Voiding keeps the original entry fully visible with
-- a reason and who/when it was voided, instead of erasing or rewriting it.

alter table incidents
  add column if not exists void boolean not null default false,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references staff_accounts(id),
  add column if not exists voided_at timestamptz;

comment on column incidents.void is
  'True once this incident has been voided as a mistake — the row stays, this just marks it not actionable.';
comment on column incidents.void_reason is
  'Required explanation for why this incident was voided.';
