-- Tasks can be about one apartment ("check the status of Lisbon"): the
-- Manager or Supervisor picks the Resident Officer and attaches the
-- apartment. Run once in the Supabase SQL Editor, after 0009. Safe to
-- re-run; it only adds a column.
alter table tasks
  add column if not exists apartment text;

create index if not exists tasks_apartment_idx on tasks (apartment);

notify pgrst, 'reload schema';
