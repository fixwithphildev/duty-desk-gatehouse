-- Maintenance Desk production schema
-- Run this once in the Supabase SQL Editor for the maintenance-desk Supabase
-- project. This is a separate Supabase project from Duty Desk's and
-- Gatehouse's — no shared database, no shared login.
--
-- Deliberately does NOT include maintenance_tickets or
-- maintenance_ticket_photos: those live in Duty Desk's project and are the
-- one genuinely shared record between the two platforms. This app's server
-- holds a second connection (DUTY_DESK_SUPABASE_URL /
-- DUTY_DESK_SUPABASE_SERVICE_ROLE_KEY) straight to that table — see
-- src/lib/supabase.ts and src/lib/data/tickets.ts. There is nothing to sync.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Accounts & auth
-- ---------------------------------------------------------------------------

create type md_role as enum (
  'maintenance_technician',
  'maintenance_supervisor',
  'super_admin'
);

create table staff_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text generated always as (lower(username)) stored,
  usercode_hash text not null,
  display_name text not null,
  role md_role not null,
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
-- Row Level Security: enabled with no policies on every table, matching
-- Duty Desk and Gatehouse. All real access goes through the Next.js server
-- using the service-role key, which bypasses RLS. This is a defense-in-depth
-- backstop only.
-- ---------------------------------------------------------------------------

alter table staff_accounts enable row level security;
alter table login_events enable row level security;
