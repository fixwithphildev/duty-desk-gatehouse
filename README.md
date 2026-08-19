# Duty Desk, Gatehouse & Maintenance Desk

Production builds of three internal operations platforms for The Destination, per the [approved proposal](Duty-Desk-Gatehouse-Proposal.docx) and [blueprint](hotel-platforms-blueprint.md):

- **[apps/duty-desk](apps/duty-desk)** — Resident Officer department: apartment readiness checklists, complaints, maintenance tickets, duty log/handover, resident records, tasks, reports.
- **[apps/gatehouse](apps/gatehouse)** — Security department: incidents, vehicle access log, items book, patrols, alerts, reports.
- **[apps/maintenance-desk](apps/maintenance-desk)** — Maintenance department: the ticket queue for Engineering and General Maintenance work.
- **[apps/portal](apps/portal)** — a static, data-free landing page linking to all three platforms' own logins.

Each app is a standalone Next.js 14 + TypeScript project with its own `package.json`, its own login system, and its own Vercel deployment — no shared login between any of them. Duty Desk, Gatehouse, and Maintenance Desk's own accounts/sessions each live in their own separate Supabase (Postgres) project too, matching the blueprint's independence requirement — **with one deliberate, narrow exception**: `maintenance_tickets` lives in Duty Desk's database and is genuinely shared with Maintenance Desk (both platforms' servers read and write that same table directly — not a sync, not a copy). See the comments in `apps/maintenance-desk/src/lib/supabase.ts` for how that connection is scoped. `apps/portal` has no database at all.

## Login

All three platforms use a custom username + usercode login (no email/password, no third-party auth) as specified in blueprint Section 4: 8-character alphanumeric usercodes, bcrypt-hashed, with lockout after 5 failed attempts (15 minutes), a full login audit log, and a Super Admin (IT) role that sits above each platform's independent department-admin role (General Manager for Duty Desk, Security Supervisor for Gatehouse, Maintenance Supervisor for Maintenance Desk).

## Getting this running

See **[SETUP.md](SETUP.md)** for the full step-by-step walkthrough — creating the GitHub, Supabase, and Vercel accounts, running the database migrations, seeding your first Super Admin login on each platform, and deploying all four sites.

## Local development

Each app is independent:
```
cd apps/duty-desk   # or apps/gatehouse, apps/maintenance-desk, or apps/portal
npm install
npm run dev
```
Duty Desk, Gatehouse, and Maintenance Desk each require a `.env.local` (see each app's `.env.example`) pointing at their own Supabase project before most pages will load real data — see SETUP.md Steps 2–5. Maintenance Desk's `.env.local` additionally needs Duty Desk's own Supabase credentials, for the shared tickets table.
