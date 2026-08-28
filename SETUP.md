# Setup & Deployment Walkthrough

This walks you (Philip, IT Support — no other developer needed) through taking Duty Desk, Gatehouse, and Maintenance Desk from code on this computer to three live, password-protected web apps your staff can use, plus the shared landing page.

You will create **five accounts**, all free to sign up for (you only start paying once you upgrade specific plans, in Step 6):

1. A **GitHub** account — holds the code, so Vercel can deploy it.
2. A **Supabase** account — hosts the databases (one each for Duty Desk, Gatehouse, and Maintenance Desk's own logins — three total; Maintenance Desk's tickets live in Duty Desk's database, see Step 2.5).
3. A **Vercel** account — hosts the four live web apps.
4. A **Resend** account — sends the "Email this report" copies from the Reports page (free up to 3,000 emails/month).

Do the steps **in order**. Each one builds on the last. Budget about half a day, most of it waiting for things to finish rather than active work.

---

## 0. Before you start

Open a terminal in this folder (`DutyDesk-Gatehouse`). Everything below assumes you're running commands from here unless told otherwise.

You'll be generating and copying several secrets and keys during this walkthrough. Keep a temporary notes file open (a plain text file on your desktop is fine — delete it when you're done) to paste them into as you go, since some are shown only once.

---

## 1. Create a GitHub account & repository

1. Go to github.com and sign up (skip if you already have an account).
2. Click **New repository**. Name it `duty-desk-gatehouse`. Keep it **Private** (this is internal company software with real staff data). Don't initialize with a README — this folder already has one.
3. Follow GitHub's "push an existing repository" instructions, which will look like:
   ```
   git remote add origin https://github.com/YOUR-USERNAME/duty-desk-gatehouse.git
   git branch -M main
   git add .
   git commit -m "Initial production build"
   git push -u origin main
   ```
   Run these from this folder. If `git` asks you to sign in, follow its prompts (it will open a browser window).

You now have your code backed up and ready for Vercel to deploy from.

---

## 2. Create the Duty Desk Supabase project

1. Go to supabase.com and sign up.
2. Click **New project**. Name it `duty-desk-prod`. Pick a strong database password and **save it** in your notes file — you won't need it day-to-day (the app doesn't use it directly) but keep it somewhere safe. Pick a region close to your property.
3. Wait for the project to finish provisioning (a couple of minutes).
4. In the left sidebar, go to **SQL Editor** → **New query**. Open the file [`apps/duty-desk/supabase/migrations/0001_init.sql`](apps/duty-desk/supabase/migrations/0001_init.sql) from this project, copy its entire contents, paste into the SQL editor, and click **Run**. This creates every table Duty Desk needs.
5. Go to **Storage** in the left sidebar → **New bucket**. Name it exactly `maintenance-photos`. Leave it **Private** (do not make it public). This is where maintenance ticket photos are stored.
6. Go to **Project Settings → API**. You'll need two values from this page in Step 4:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **service_role key** (under "Project API keys" — click reveal). This key has full database access, so never share it or put it in client-side code. Treat it like a password.

---

## 3. Create the Gatehouse Supabase project

Repeat Step 2 exactly, but:
- Name the project `gatehouse-prod`.
- Run the SQL from [`apps/gatehouse/supabase/migrations/0001_init.sql`](apps/gatehouse/supabase/migrations/0001_init.sql) instead.
- Skip the Storage bucket — Gatehouse doesn't use photo uploads.
- Note down its own separate **Project URL** and **service_role key**.

You now have two completely separate databases, matching the blueprint's "no shared database" requirement.

---

## 3.4. Create the Maintenance Desk Supabase project — and one small change to Duty Desk's

Maintenance Desk is a genuinely separate third platform (own login, own staff accounts) with one deliberate exception: maintenance tickets are a single shared record between it and Duty Desk, not a copy that gets synced. Concretely, that means Maintenance Desk's own database holds only its logins, while its server also connects straight to Duty Desk's existing database for the tickets table — see the comments in `apps/maintenance-desk/src/lib/supabase.ts` if you want the full explanation.

1. Repeat Step 2 exactly for a third project — name it `maintenance-desk-prod`, run the SQL from [`apps/maintenance-desk/supabase/migrations/0001_init.sql`](apps/maintenance-desk/supabase/migrations/0001_init.sql), skip the Storage bucket, and note down its own **Project URL** and **service_role key**.
2. Now go back to your **existing** `duty-desk-prod` project (not the new one) → **SQL Editor** → **New query**. Run [`apps/duty-desk/supabase/migrations/0002_maintenance_desk_integration.sql`](apps/duty-desk/supabase/migrations/0002_maintenance_desk_integration.sql). This just adds one text column to the existing `maintenance_tickets` table (who last touched a ticket, from either platform) — it doesn't touch any existing data.

---

## 3.5. Create a Resend account (for the "Email report" button)

1. Go to resend.com and sign up.
2. Go to **API Keys** → **Create API Key**. Name it anything (e.g. "duty-desk-gatehouse"), leave permissions as default ("Full access"), and copy the key it shows you — like the Supabase service_role key, it's shown once.
3. That's it for now — you don't need to verify a domain to get started. Resend gives you a shared sending address, `onboarding@resend.dev`, that works immediately for testing. If you want emails to come from your own domain later (e.g. `reports@thedestination.com`), Resend's **Domains** tab walks you through adding a couple of DNS records — optional, do it whenever you're ready.
4. You can reuse this **same** Resend account and API key for both Duty Desk and Gatehouse — it's just an email-sending tool, not part of either platform's own data, so reusing it doesn't break the "fully independent platforms" rule.

---

## 4. Configure local environment files

For each app, copy the example env file and fill in the values from Steps 2–3 (and 3.5 for the email keys).

**Duty Desk** — create `apps/duty-desk/.env.local`:
```
SUPABASE_URL=<Duty Desk Project URL from step 2>
SUPABASE_SERVICE_ROLE_KEY=<Duty Desk service_role key from step 2>
SESSION_SECRET=<a random string — see below>
MAINTENANCE_PHOTOS_BUCKET=maintenance-photos
RESEND_API_KEY=<your Resend API key from step 3.5>
REPORTS_FROM_EMAIL=onboarding@resend.dev
```

**Gatehouse** — create `apps/gatehouse/.env.local`:
```
SUPABASE_URL=<Gatehouse Project URL from step 3>
SUPABASE_SERVICE_ROLE_KEY=<Gatehouse service_role key from step 3>
SESSION_SECRET=<a DIFFERENT random string>
RESEND_API_KEY=<your Resend API key from step 3.5 — can be the same key as Duty Desk's>
REPORTS_FROM_EMAIL=onboarding@resend.dev
```

**Maintenance Desk** — create `apps/maintenance-desk/.env.local`:
```
SUPABASE_URL=<Maintenance Desk Project URL from step 3.4>
SUPABASE_SERVICE_ROLE_KEY=<Maintenance Desk service_role key from step 3.4>
DUTY_DESK_SUPABASE_URL=<the SAME Duty Desk Project URL from step 2 — not a new value>
DUTY_DESK_SUPABASE_SERVICE_ROLE_KEY=<the SAME Duty Desk service_role key from step 2>
SESSION_SECRET=<a THIRD different random string>
MAINTENANCE_PHOTOS_BUCKET=maintenance-photos
```
The `DUTY_DESK_SUPABASE_*` pair is intentionally a copy of Duty Desk's own credentials from Step 2 — that's what gives Maintenance Desk its direct connection to the shared tickets table. Everything else about this file (its own `SUPABASE_URL`, its own `SESSION_SECRET`) is unique to Maintenance Desk, same as the other two apps.

To generate a `SESSION_SECRET`, run this once for each app and paste the result in:
```
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```
Use a **different** secret for each app — this is what keeps a Duty Desk login session cryptographically separate from a Gatehouse or Maintenance Desk one.

These `.env.local` files are already excluded from git (see each app's `.gitignore`) — they hold secrets and should never be committed.

---

## 5. Create your own Super Admin login on each platform

This is the one-time step that gets **you** your first username and usercode on each platform, before anyone else can log in (there's no sign-up page by design — see blueprint Section 4.1).

From this folder:
```
cd apps/duty-desk
npm install
npm run seed:super-admin
```
Follow the prompts (pick a username, e.g. `p.atabo`). **Write down the usercode it prints — it is shown once and stored only as an unreadable hash from then on.**

Then do the same for Gatehouse:
```
cd ../gatehouse
npm install
npm run seed:super-admin
```
Use a **different** usercode than the one you got for Duty Desk (they're independent logins on independent systems, per the blueprint).

And once more for Maintenance Desk:
```
cd ../maintenance-desk
npm install
npm run seed:super-admin
```
Again, a different usercode from the other two.

You can sanity-check either app locally before deploying:
```
npm run dev
```
then open `http://localhost:3000/login` and sign in with the username/usercode you just created.

---

## 6. Create your Vercel account and the four hosting projects

1. Go to vercel.com and sign up **using your GitHub account** (this makes connecting the repo a one-click step).
2. From your Vercel dashboard, click **Add New → Project**, and import the `duty-desk-gatehouse` repository (you may need to click "Configure GitHub App" once to grant Vercel access to it).
3. Vercel will ask for a **Root Directory** — this is the key setting that makes one repo produce several independent apps. Set it to `apps/duty-desk`. Leave the framework preset on "Next.js" (auto-detected).
4. Before clicking Deploy, expand **Environment Variables** and add the values from your `apps/duty-desk/.env.local` file: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `MAINTENANCE_PHOTOS_BUCKET`, `RESEND_API_KEY`, `REPORTS_FROM_EMAIL`. Skip `NEXT_PUBLIC_PORTAL_URL` for now — you don't have the portal's URL yet (step 7 creates it).
5. Click **Deploy**. Wait for it to finish, then open the URL Vercel gives you (something like `duty-desk-gatehouse.vercel.app`) and confirm the login page loads.
6. Repeat steps 2–5 for a **second** Vercel project: Root Directory `apps/gatehouse`, using the Gatehouse env values (same set minus `MAINTENANCE_PHOTOS_BUCKET`, also skipping `NEXT_PUBLIC_PORTAL_URL` for now).
7. Repeat once more for a **third** Vercel project: Root Directory `apps/maintenance-desk`, using the values from `apps/maintenance-desk/.env.local` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DUTY_DESK_SUPABASE_URL`, `DUTY_DESK_SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `MAINTENANCE_PHOTOS_BUCKET`), again skipping `NEXT_PUBLIC_PORTAL_URL` for now.
8. Repeat once more for a **fourth** Vercel project: Root Directory `apps/portal`. Its environment variables are the three live URLs from steps 5–7:
   ```
   NEXT_PUBLIC_DUTY_DESK_URL=<your Duty Desk Vercel URL>
   NEXT_PUBLIC_GATEHOUSE_URL=<your Gatehouse Vercel URL>
   NEXT_PUBLIC_MAINTENANCE_DESK_URL=<your Maintenance Desk Vercel URL>
   ```
9. Now that you have the portal's URL, go back to **each** of the Duty Desk, Gatehouse, and Maintenance Desk projects → **Settings → Environment Variables** and add:
   ```
   NEXT_PUBLIC_PORTAL_URL=<your Portal Vercel URL>
   ```
   This is what makes the "Back to portal" link show up on each login page. Redeploy all three (**Deployments → ⋯ → Redeploy**) for it to take effect.

You now have four live, independently-hosted sites, cross-linked to each other. Bookmark the portal URL and share that one with staff — it links out to all three.

### Upgrading to paid plans (before real rollout)

Free tiers pause when idle for ~7 days and have no backup guarantee, so paid tiers are the ideal before real staff/guest data depends on this day to day:
- **Vercel**: from your Vercel dashboard, go to your account/team **Settings → Billing** and upgrade to the **Pro** plan (~$20/month). This covers all four projects under one account.
- **Supabase**: bills per **organization**, not per project — a ~$25/month base subscription per org, plus a ~$10/month compute add-on for every project in that org beyond the first (which the base subscription's included credit already covers). Right now that's two organizations (Duty Desk + Gatehouse in one, Maintenance Desk in a second, opened only to get around the free tier's 2-project cap), which comes to ~$780/year total. See "Consolidating to one Supabase project" below to bring that down to ~$540/year by merging into a single organization.

You can complete Steps 1–8 (below) on the free tiers first to confirm everything works, then upgrade once you're ready for real rollout.

### If you're not ready to pay for anything yet

Two GitHub Actions workflows already in this repo (`.github/workflows/keep-alive.yml` and `backup.yml`) cover the two real risks of staying on free tier, at no cost:
- **keep-alive.yml** pings each Supabase project every 3 days so none of them ever go idle long enough to hit the ~7-day auto-pause.
- **backup.yml** dumps each project's database every Monday and keeps 60 days of snapshots as workflow artifacts (visible under the repo's **Actions** tab → a run → Artifacts), so there's always a recent restore point.

Both need a few repository secrets before they'll run — on GitHub, go to the repo's **Settings → Secrets and variables → Actions** and add:
- `DUTY_DESK_SUPABASE_URL`, `DUTY_DESK_SUPABASE_SERVICE_ROLE_KEY` — same values as `apps/duty-desk/.env.local`.
- `GATEHOUSE_SUPABASE_URL`, `GATEHOUSE_SUPABASE_SERVICE_ROLE_KEY` — same values as `apps/gatehouse/.env.local`.
- `MAINTENANCE_DESK_SUPABASE_URL`, `MAINTENANCE_DESK_SUPABASE_SERVICE_ROLE_KEY` — same values as `apps/maintenance-desk/.env.local`.
- `DUTY_DESK_DB_URL`, `GATEHOUSE_DB_URL`, `MAINTENANCE_DESK_DB_URL` — each project's Postgres connection string (different from the URL/key pair above), found under that project's **Connect → Direct connection string** tab in the Supabase dashboard. Use the **Session pooler** option, not "Direct connection" — Supabase's direct connection is IPv6-only by default, and GitHub-hosted runners can't reach IPv6 hosts (`pg_dump` fails with "Network is unreachable"). The Session pooler string is IPv4-compatible.

Once those are added, both workflows run on their own schedule (or trigger one manually from the Actions tab with "Run workflow" to test it immediately). Check the Actions tab occasionally — a red X means a ping or a dump failed and is worth a look.

### Consolidating to one Supabase project (optional, cuts the paid rate from ~$780/yr to ~$540/yr)

Supabase's per-organization base fee is what makes splitting departments across projects expensive — merging Gatehouse's and Maintenance Desk's tables into Duty Desk's project (under their own schemas, still fully separated from Duty Desk's own tables) avoids paying that base fee twice. The app code already supports this: both `apps/gatehouse/src/lib/supabase.ts` and `apps/maintenance-desk/src/lib/supabase.ts` read an optional `SUPABASE_SCHEMA` environment variable (defaulting to `public`), so no code changes are needed to do this — only data and configuration.

1. In the Duty Desk Supabase project's SQL Editor, run `apps/duty-desk/supabase/migrations/0003_consolidate_departments.sql`. This creates two empty schemas, `gatehouse` and `maintenance`, inside Duty Desk's database.
2. From a terminal with `pg_dump`/`psql` installed (or the Bash tool, if working with Claude), pull each project's connection string from **Project Settings → Database → Connection string** and run, for Gatehouse:
   ```
   pg_dump "$GATEHOUSE_DB_URL" --no-owner --no-privileges --schema=public -f gatehouse_dump.sql
   sed -i 's/public\./gatehouse./g; s/SCHEMA public/SCHEMA gatehouse/g' gatehouse_dump.sql
   psql "$DUTY_DESK_DB_URL" -f gatehouse_dump.sql
   ```
   and the same for Maintenance Desk, substituting `maintenance` for `gatehouse` throughout.
3. In the Duty Desk project's dashboard, go to **Project Settings → API → Exposed schemas** and add `gatehouse` and `maintenance` to the list (alongside `public`) — otherwise the API can't see tables outside `public`.
4. Update `apps/gatehouse/.env.local` (and its Vercel project's environment variables) to Duty Desk's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and add `SUPABASE_SCHEMA=gatehouse`. Do the same for `apps/maintenance-desk/.env.local` (and its Vercel project) with `SUPABASE_SCHEMA=maintenance`.
5. Redeploy both, then log in and spot-check each platform still works end to end before touching anything else.
6. Once confirmed, downgrade or delete the old Gatehouse and Maintenance Desk Supabase projects (and the second Supabase account, if nothing else uses it), and trim `keep-alive.yml`/`backup.yml` down to just the Duty Desk secrets — the code comments in both files mark exactly what to remove.

---

## 7. (Optional) Add a company domain

If you'd rather use `operations.yourcompany.com` than a `.vercel.app` address: buy the domain from any registrar, then in each Vercel project go to **Settings → Domains** and follow Vercel's instructions to add a subdomain and point its DNS record at that project. Do this any time after launch — it doesn't require touching the code.

---

## 8. Set up your department admins

Log in to Duty Desk as your Super Admin account and go to **Staff Accounts** in the sidebar:
1. Create an account for your **General Manager** with the role "General Manager". Give them the username/usercode shown.
2. They can now log in and create the 16 Resident Officer / Front Desk / Housekeeping / Engineering accounts themselves, or you can create them on their behalf.

Log in to Gatehouse as your Super Admin account and do the same for your **Security Supervisor** (role "Security Supervisor"), who then creates the 5 Security Officer accounts.

Log in to Maintenance Desk as your Super Admin account and do the same for your **Maintenance Supervisor**, who then creates the Maintenance Technician accounts.

From here on, day-to-day account creation, disabling, and usercode resets are handled by these department admins — you (Super Admin) are the fallback if any of them is ever locked out or needs help, per blueprint Section 4.1.

---

## Day-to-day admin quick reference

- **Add a new staff member**: Staff Accounts → New account → pick a username and role. The usercode is generated automatically and shown once — write it down and hand it to the staff member directly (never over email/text, since there's no password-reset flow that verifies identity).
- **Staff member forgot their usercode / it's compromised**: Staff Accounts → find their row → **Reset code** → hand them the new one.
- **Staff member left**: Staff Accounts → find their row → **Disable**. Their past entries stay in the system under their name; they just can't log in anymore.
- **Account locked** (5 wrong usercode attempts): it unlocks itself after 15 minutes, or an admin can click **Unlock** immediately.
- **Staff can change their own usercode** any time after logging in, from **My Account** in the sidebar.
- **Reports page**: shows trend charts and breakdowns, plus per-dataset **Download** (CSV) and **Email** buttons for backups or sharing outside the system.

---

## Staying on security patches

This build pins Next.js to a specific version rather than "always latest," so upgrades are deliberate rather than automatic. Every so often (e.g. quarterly), it's worth running `npm audit` in each app folder and asking Claude Code to review whether an update is warranted — especially for anything flagged **critical**. Don't blindly run `npm audit fix --force`; it can jump major versions and break things without testing.

---

## Redeploying after a code change

Because Vercel is connected to your GitHub repo, any update is just:
```
git add .
git commit -m "describe the change"
git push
```
Vercel automatically rebuilds and redeploys within a minute or two of the push. No manual redeploy step needed.
