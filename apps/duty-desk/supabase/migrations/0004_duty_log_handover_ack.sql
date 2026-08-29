-- Lets a shift handover note be marked as handled, instead of staying
-- pinned to the dashboard forever. The dashboard now shows the most recent
-- handover-flagged entry that has NOT been acknowledged yet; once someone
-- acknowledges it, it stops showing for everyone (not just the person who
-- clicked), and the next unacknowledged handover note (if any) takes its
-- place.

alter table duty_log_entries
  add column if not exists acknowledged_by uuid references staff_accounts(id),
  add column if not exists acknowledged_at timestamptz;

comment on column duty_log_entries.acknowledged_by is
  'Who marked this shift handover note as handled. Only meaningful when handover = true.';
comment on column duty_log_entries.acknowledged_at is
  'When this handover note was marked handled. Null means it is still outstanding and shows on the dashboard.';
