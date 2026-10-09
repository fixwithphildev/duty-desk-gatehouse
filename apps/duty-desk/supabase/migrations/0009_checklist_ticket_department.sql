-- Check-in prep: the officer chooses which department a flagged item's ticket
-- goes to (the usual one is pre-selected). Kept on the item while the
-- inspection is in progress, so a take-over or a reopened phone keeps the
-- choice. Run once in the Supabase SQL Editor, after 0008. Safe to re-run;
-- it only adds a column.
alter table checklist_items
  add column if not exists ticket_dept text;

notify pgrst, 'reload schema';
