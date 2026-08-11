-- Duty Desk production schema
-- Run this once in the Supabase SQL Editor for the duty-desk Supabase project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Accounts & auth
-- ---------------------------------------------------------------------------

create type dd_role as enum (
  'resident_officer',
  'front_desk',
  'housekeeping',
  'engineering',
  'general_manager',
  'super_admin'
);

create table staff_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text generated always as (lower(username)) stored,
  usercode_hash text not null,
  display_name text not null,
  role dd_role not null,
  disabled boolean not null default false,
  must_change_code boolean not null default false,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_by uuid references staff_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index staff_accounts_username_unique on staff_accounts (username_lower);

create table login_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff_accounts(id),
  username_attempted text not null,
  success boolean not null,
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index login_events_staff_id_idx on login_events (staff_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Apartment Readiness Checklist
-- ---------------------------------------------------------------------------

create type dd_checklist_type as enum ('check_in_prep', 'check_out_inspection');
create type dd_checklist_status as enum ('in_progress', 'submitted');
create type dd_condition as enum ('Good', 'Damaged', 'Missing', 'N/A');

create table apartment_checklists (
  id uuid primary key default gen_random_uuid(),
  apartment text not null,
  type dd_checklist_type not null,
  prepared_by uuid not null references staff_accounts(id),
  status dd_checklist_status not null default 'submitted',
  overall_ready boolean not null default true,
  created_at timestamptz not null default now()
);
create index apartment_checklists_apartment_idx on apartment_checklists (lower(apartment), created_at desc);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references apartment_checklists(id) on delete cascade,
  name text not null,
  category text not null,
  kind text not null, -- 'condition' | 'yesno'
  qty text,
  condition dd_condition,
  available text, -- 'Yes' | 'No'
  linked_ticket_id uuid
);
create index checklist_items_checklist_id_idx on checklist_items (checklist_id);

-- ---------------------------------------------------------------------------
-- Complaints
-- ---------------------------------------------------------------------------

create type dd_priority as enum ('Low', 'Medium', 'High');
create type dd_complaint_status as enum ('Open', 'In Progress', 'Resolved');

create table complaints (
  id uuid primary key default gen_random_uuid(),
  guest_name text,
  room text,
  category text not null,
  priority dd_priority not null default 'Medium',
  description text not null,
  status dd_complaint_status not null default 'Open',
  created_by uuid not null references staff_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Maintenance tickets
-- ---------------------------------------------------------------------------

create type dd_ticket_status as enum ('Reported', 'In Progress', 'Resolved');

create table maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  issue_type text not null,
  assigned_to text not null,
  priority dd_priority not null default 'Medium',
  status dd_ticket_status not null default 'Reported',
  source text not null default 'manual', -- 'manual' | 'checklist'
  notes text,
  created_by uuid references staff_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table checklist_items
  add constraint checklist_items_linked_ticket_fk
  foreign key (linked_ticket_id) references maintenance_tickets(id);

create table maintenance_ticket_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references maintenance_tickets(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Duty log / handover
-- ---------------------------------------------------------------------------

create table duty_log_entries (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references staff_accounts(id),
  notes text not null,
  handover boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Residents
-- ---------------------------------------------------------------------------

create table resident_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  room text not null,
  check_in date,
  check_out date,
  preferences text,
  contact_info text,
  notes text,
  created_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create type dd_task_status as enum ('Pending', 'Done');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  assigned_to text,
  due_time text,
  status dd_task_status not null default 'Pending',
  created_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: default-deny on every table.
-- All real access goes through the Next.js server using the service-role
-- key, which bypasses RLS. This is a defense-in-depth backstop only, in
-- case a key is ever exposed to a client.
-- ---------------------------------------------------------------------------

alter table staff_accounts enable row level security;
alter table login_events enable row level security;
alter table apartment_checklists enable row level security;
alter table checklist_items enable row level security;
alter table complaints enable row level security;
alter table maintenance_tickets enable row level security;
alter table maintenance_ticket_photos enable row level security;
alter table duty_log_entries enable row level security;
alter table resident_profiles enable row level security;
alter table tasks enable row level security;
-- No policies are created, so with RLS enabled the only role that can read
-- or write is the service_role (which bypasses RLS entirely).
