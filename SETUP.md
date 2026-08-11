# Setup & Deployment Walkthrough

This walks you (Philip, IT Support — no other developer needed) through taking Duty Desk and Gatehouse from code on this computer to two live, password-protected web apps your staff can use, plus the shared landing page.

You will create **four accounts**, all free to sign up for (you only start paying once you upgrade specific plans, in Step 6):

1. A **GitHub** account — holds the code, so Vercel can deploy it.
2. A **Supabase** account — hosts the two databases (one for Duty Desk, one for Gatehouse).
3. A **Vercel** account — hosts the three live web apps.

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

## 4. Configure local environment files

For each app, copy the example env file and fill in the values from Steps 2–3.

**Duty Desk** — create `apps/duty-desk/.env.local`:
```
SUPABASE_URL=<Duty Desk Project URL from step 2>
SUPABASE_SERVICE_ROLE_KEY=<Duty Desk service_role key from step 2>
SESSION_SECRET=<a random string — see below>
MAINTENANCE_PHOTOS_BUCKET=maintenance-photos
```

**Gatehouse** — create `apps/gatehouse/.env.local`:
```
SUPABASE_URL=<Gatehouse Project URL from step 3>
SUPABASE_SERVICE_ROLE_KEY=<Gatehouse service_role key from step 3>
SESSION_SECRET=<a DIFFERENT random string>
```

To generate a `SESSION_SECRET`, run this once for each app and paste the result in:
```
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```
Use a **different** secret for each app — this is what keeps a Duty Desk login session cryptographically separate from a Gatehouse one.

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

You can sanity-check either app locally before deploying:
```
npm run dev
```
then open `http://localhost:3000/login` and sign in with the username/usercode you just created.

---

## 6. Create your Vercel account and the three hosting projects

1. Go to vercel.com and sign up **using your GitHub account** (this makes connecting the repo a one-click step).
2. From your Vercel dashboard, click **Add New → Project**, and import the `duty-desk-gatehouse` repository (you may need to click "Configure GitHub App" once to grant Vercel access to it).
3. Vercel will ask for a **Root Directory** — this is the key setting that makes one repo produce three independent apps. Set it to `apps/duty-desk`. Leave the framework preset on "Next.js" (auto-detected).
4. Before clicking Deploy, expand **Environment Variables** and add the same three (Duty Desk) values from your `apps/duty-desk/.env.local` file: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `MAINTENANCE_PHOTOS_BUCKET`.
5. Click **Deploy**. Wait for it to finish, then open the URL Vercel gives you (something like `duty-desk-gatehouse.vercel.app`) and confirm the login page loads.
6. Repeat steps 2–5 for a **second** Vercel project: Root Directory `apps/gatehouse`, using the Gatehouse env values.
7. Repeat once more for a **third** Vercel project: Root Directory `apps/portal`. Its environment variables are the two live URLs from steps 5–6:
   ```
   NEXT_PUBLIC_DUTY_DESK_URL=<your Duty Desk Vercel URL>
   NEXT_PUBLIC_GATEHOUSE_URL=<your Gatehouse Vercel URL>
   ```

You now have three live, independently-hosted sites. Bookmark the portal URL and share that one with staff — it links out to both.

### Upgrading to paid plans (before real rollout)

The proposal (Section 7.1) calls for paid tiers before going live with real staff/guest data, since free tiers pause when idle and have no backup guarantee:
- **Vercel**: from your Vercel dashboard, go to your account/team **Settings → Billing** and upgrade to the **Pro** plan (~$20/month). This covers all three projects under one account.
- **Supabase**: for **each** of the two projects, go to **Project Settings → Billing** and upgrade to **Pro** (~$25/month each). This enables daily backups and removes the auto-pause on inactivity.

You can complete Steps 1–8 (below) on the free tiers first to confirm everything works, then upgrade once you're ready for real rollout.

---

## 7. (Optional) Add a company domain

If you'd rather use `operations.yourcompany.com` than a `.vercel.app` address: buy the domain from any registrar, then in each Vercel project go to **Settings → Domains** and follow Vercel's instructions to add a subdomain and point its DNS record at that project. Do this any time after launch — it doesn't require touching the code.

---

## 8. Set up your two department admins

Log in to Duty Desk as your Super Admin account and go to **Staff Accounts** in the sidebar:
1. Create an account for your **General Manager** with the role "General Manager". Give them the username/usercode shown.
2. They can now log in and create the 16 Resident Officer / Front Desk / Housekeeping / Engineering accounts themselves, or you can create them on their behalf.

Log in to Gatehouse as your Super Admin account and do the same for your **Security Supervisor** (role "Security Supervisor"), who then creates the 5 Security Officer accounts.

From here on, day-to-day account creation, disabling, and usercode resets are handled by these two department admins — you (Super Admin) are the fallback if either of them is ever locked out or needs help, per blueprint Section 4.1.

---

## Day-to-day admin quick reference

- **Add a new staff member**: Staff Accounts → New account → pick a username and role. The usercode is generated automatically and shown once — write it down and hand it to the staff member directly (never over email/text, since there's no password-reset flow that verifies identity).
- **Staff member forgot their usercode / it's compromised**: Staff Accounts → find their row → **Reset code** → hand them the new one.
- **Staff member left**: Staff Accounts → find their row → **Disable**. Their past entries stay in the system under their name; they just can't log in anymore.
- **Account locked** (5 wrong usercode attempts): it unlocks itself after 15 minutes, or an admin can click **Unlock** immediately.
- **Staff can change their own usercode** any time after logging in, from **My Account** in the sidebar.

---

## Redeploying after a code change

Because Vercel is connected to your GitHub repo, any update is just:
```
git add .
git commit -m "describe the change"
git push
```
Vercel automatically rebuilds and redeploys within a minute or two of the push. No manual redeploy step needed.
