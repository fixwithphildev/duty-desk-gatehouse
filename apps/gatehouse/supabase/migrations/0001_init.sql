-- Gatehouse production schema
-- Run this once in the Supabase SQL Editor for the gatehouse Supabase project.
-- This is a separate Supabase project from Duty Desk's — no shared database.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Accounts & auth
-- ---------------------------------------------------------------------------

create type gh_role as enum (
  'security_officer',
  'security_supervisor',
  'management',
  'super_admin'
);

create table staff_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text generated always as (lower(username)) stored,
  usercode_hash text not null,
  display_name text not null,
  role gh_role not null,
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
-- Incidents
-- ---------------------------------------------------------------------------

create type gh_severity as enum ('Low', 'Medium', 'High', 'Critical');
create type gh_incident_status as enum ('Open', 'In Progress', 'Resolved');

create table incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  severity gh_severity not null default 'Low',
  location text,
  description text,
  reported_by uuid references staff_accounts(id),
  status gh_incident_status not null default 'Open',
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Vehicle access log
-- ---------------------------------------------------------------------------

create type gh_vehicle_status as enum ('In', 'Returned');

create table vehicle_logs (
  id uuid primary key default gen_random_uuid(),
  card_number text not null,
  plate_number text not null,
  driver_name text,
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  status gh_vehicle_status not null default 'In',
  logged_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Items book
-- ---------------------------------------------------------------------------

create type gh_item_status as enum ('Out', 'Returned');

create table item_logs (
  id uuid primary key default gen_random_uuid(),
  item_desc text not null,
  carried_by text not null,
  authorized_by text,
  out_at timestamptz not null default now(),
  in_at timestamptz,
  status gh_item_status not null default 'Out',
  logged_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Staff attendance (on duty) & off-duty visitor attendance
-- ---------------------------------------------------------------------------

create type gh_attendance_status as enum ('Signed In', 'Signed Out');

create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  staff_name text not null,
  role text,
  in_at timestamptz not null default now(),
  out_at timestamptz,
  status gh_attendance_status not null default 'Signed In',
  logged_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

create table off_duty_logs (
  id uuid primary key default gen_random_uuid(),
  staff_name text not null,
  department text,
  reason text,
  in_at timestamptz not null default now(),
  out_at timestamptz,
  status gh_attendance_status not null default 'Signed In',
  logged_by uuid references staff_accounts(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Patrols
-- ---------------------------------------------------------------------------

create type gh_patrol_status as enum ('In Progress', 'Completed');

create table patrols (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid references staff_accounts(id),
  route text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  status gh_patrol_status not null default 'In Progress',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access & key management
-- ---------------------------------------------------------------------------

create type gh_key_status as enum ('Issued', 'Returned', 'Lost');

create table key_records (
  id uuid primary key default gen_random_uuid(),
  key_type text not null,
  area text not null,
  issued_to text not null,
  issued_by uuid references staff_accounts(id),
  issued_at timestamptz not null default now(),
  returned_at timestamptz,
  status gh_key_status not null default 'Issued',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------

create type gh_alert_status as enum ('Unacknowledged', 'Acknowledged');

create table alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity gh_severity not null default 'Medium',
  message text not null,
  location text,
  raised_by uuid references staff_accounts(id),
  status gh_alert_status not null default 'Unacknowledged',
  acknowledged_by uuid references staff_accounts(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: default-deny on every table (see Duty Desk migration
-- for the rationale — all real access goes through the server-side
-- service-role key in the Next.js app).
-- ---------------------------------------------------------------------------

alter table staff_accounts enable row level security;
alter table login_events enable row level security;
alter table incidents enable row level security;
alter table vehicle_logs enable row level security;
alter table item_logs enable row level security;
alter table attendance_logs enable row level security;
alter table off_duty_logs enable row level security;
alter table patrols enable row level security;
alter table key_records enable row level security;
alter table alerts enable row level security;
