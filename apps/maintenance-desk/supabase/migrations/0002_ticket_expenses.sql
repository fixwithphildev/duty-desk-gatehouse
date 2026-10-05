-- Maintenance spending: what was bought to fix each ticket, plus a read-only
-- Head of Operations role to review and download the spending reports.
-- Run this once in the Supabase SQL Editor for the maintenance-desk project
-- (NOT Duty Desk's). Safe to run on a live database — it only adds things.
--
-- Why this lives here and not next to maintenance_tickets in Duty Desk's
-- project: spending is Maintenance's own operational data — Duty Desk never
-- reads or writes it. ticket_id therefore can't be a real foreign key (the
-- ticket row is in another database); the app joins the two in code. See
-- src/lib/data/expenses.ts.

alter type md_role add value if not exists 'head_of_operations';

-- One row per item bought. A ticket's cost is the sum of its non-void lines.
create table ticket_expenses (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  item text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  supplier text,
  -- The date the purchase was made — what the weekly/monthly/yearly
  -- reports bucket by, not created_at, so a receipt entered a few days
  -- late still lands in the right period.
  purchased_on date not null default current_date,
  recorded_by uuid references staff_accounts(id),
  recorded_by_name text not null,
  created_at timestamptz not null default now(),
  -- Same Void correction pattern as every other record on the three
  -- platforms: a wrong line is never edited or deleted, just voided with a
  -- reason, and excluded from totals.
  void boolean not null default false,
  void_reason text,
  voided_by_name text,
  voided_at timestamptz
);
create index ticket_expenses_ticket_id_idx on ticket_expenses (ticket_id);
create index ticket_expenses_purchased_on_idx on ticket_expenses (purchased_on);

-- Records that a ticket was resolved with nothing bought, so the reports can
-- tell "fixed for free" apart from "cost never entered".
create table ticket_no_purchase (
  ticket_id uuid primary key,
  marked_by_name text not null,
  marked_at timestamptz not null default now()
);

alter table ticket_expenses enable row level security;
alter table ticket_no_purchase enable row level security;
