# Duty Desk & Gatehouse

Production builds of two independent internal operations platforms for The Destination, per the [approved proposal](Duty-Desk-Gatehouse-Proposal.docx) and [blueprint](hotel-platforms-blueprint.md):

- **[apps/duty-desk](apps/duty-desk)** — Resident Officer department: apartment readiness checklists, complaints, maintenance tickets, duty log/handover, resident records, tasks, reports.
- **[apps/gatehouse](apps/gatehouse)** — Security department: incidents, vehicle access log, items book, staff/off-duty attendance, patrols, keys, alerts, reports.
- **[apps/portal](apps/portal)** — a static, data-free landing page linking to both platforms' own logins.

Each app is a standalone Next.js 14 + TypeScript project with its own `package.json`, its own Supabase (Postgres) project, and its own Vercel deployment — there is no shared login, database, or hosting between Duty Desk and Gatehouse, matching the blueprint's independence requirement. `apps/portal` has no database at all.

## Login

Both platforms use a custom username + usercode login (no email/password, no third-party auth) as specified in blueprint Section 4: 8-character alphanumeric usercodes, bcrypt-hashed, with lockout after 5 failed attempts (15 minutes), a full login audit log, and a Super Admin (IT) role that sits above both platforms' independent department-admin roles (General Manager for Duty Desk, Security Supervisor for Gatehouse).

## Getting this running

See **[SETUP.md](SETUP.md)** for the full step-by-step walkthrough — creating the GitHub, Supabase, and Vercel accounts, running the database migrations, seeding your first Super Admin login on each platform, and deploying all three sites.

## Local development

Each app is independent:
```
cd apps/duty-desk   # or apps/gatehouse, or apps/portal
npm install
npm run dev
```
Duty Desk and Gatehouse both require a `.env.local` (see each app's `.env.example`) pointing at their own Supabase project before most pages will load real data — see SETUP.md Steps 2–5.
