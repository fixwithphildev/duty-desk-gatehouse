-- A task can be about several apartments ("check the status of Lisbon,
-- Toronto and Munich"). Run once in the Supabase SQL Editor, after 0010.
-- Safe to re-run; it only adds a column and copies any single apartment
-- already on a task into it.
alter table tasks
  add column if not exists apartments text[];

update tasks set apartments = array[apartment]
  where apartment is not null and apartments is null;

create index if not exists tasks_apartments_idx on tasks using gin (apartments);

notify pgrst, 'reload schema';
