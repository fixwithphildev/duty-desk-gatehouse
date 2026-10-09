-- Maintenance Desk redesign. Maintenance Desk's own tables now live in the
-- `maintenance` schema of the Duty Desk Supabase project, so run this once in
-- THAT project's SQL Editor, after apps/duty-desk/supabase/migrations/
-- 0008_maintenance_work_and_requests.sql. Safe to re-run; it only adds things.

-- The Maintenance Manager (Mr. Eric Oyigbo): runs requests, costs and funding
-- like the Supervisor, and can reset or switch off Supervisor and Technician
-- accounts. Only the Admin creates accounts.
alter type maintenance.md_role add value if not exists 'maintenance_manager';

-- Each technician belongs to one unit: General Maintenance, Electrician,
-- Plumbing & Building, Painting or Welding.
alter table maintenance.staff_accounts
  add column if not exists unit text;

-- Costs: a purchase can be for a job (a ticket or a request) or stock a unit
-- keeps in its store (no ticket). Every line belongs to a unit, and the lines
-- of one receipt share a receipt_id.
alter table maintenance.ticket_expenses
  alter column ticket_id drop not null;
alter table maintenance.ticket_expenses
  add column if not exists unit text,
  add column if not exists receipt_id uuid;
update maintenance.ticket_expenses e
  set unit = t.assigned_to
  from public.maintenance_tickets t
  where e.ticket_id = t.id and e.unit is null;
create index if not exists ticket_expenses_unit_idx on maintenance.ticket_expenses (unit, purchased_on);

-- Funding: money Finance releases for a job, often part up front and the rest
-- when it's done, and any money returned. One row per job for the amount it
-- needs, and one row per payment either way.
create table if not exists maintenance.ticket_funding (
  ticket_id uuid primary key references public.maintenance_tickets(id),
  amount_needed numeric(14,2) not null check (amount_needed >= 0),
  balance_requested_at timestamptz,
  balance_requested_amount numeric(14,2),
  balance_requested_by_name text,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

create table if not exists maintenance.funding_transactions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.maintenance_tickets(id),
  -- advance: released before or during the job · balance: paid after it's
  -- done · return: unspent money given back to Finance
  kind text not null check (kind in ('advance', 'balance', 'return')),
  amount numeric(14,2) not null check (amount > 0),
  tx_date date not null default current_date,
  reference text,        -- voucher, transfer or receipt number
  finance_officer text,  -- who released or received it in Finance
  pays_back text,        -- for a balance: the supplier or person it repays
  recorded_by uuid references maintenance.staff_accounts(id),
  recorded_by_name text not null,
  created_at timestamptz not null default now(),
  -- Same correction pattern as everything else: never edited or deleted,
  -- only voided with a reason.
  void boolean not null default false,
  void_reason text,
  voided_by_name text,
  voided_at timestamptz
);
create index if not exists funding_transactions_ticket_idx on maintenance.funding_transactions (ticket_id);

alter table maintenance.ticket_funding enable row level security;
alter table maintenance.funding_transactions enable row level security;
grant all on maintenance.ticket_funding, maintenance.funding_transactions to service_role;

notify pgrst, 'reload schema';
