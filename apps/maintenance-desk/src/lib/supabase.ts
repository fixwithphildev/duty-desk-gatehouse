import "server-only";
import { createClient } from "@supabase/supabase-js";

// Two Supabase projects, two purposes — this is the whole architecture in
// one file:
//
// - `supabaseAdmin` is THIS platform's own project: staff_accounts,
//   login_events, sessions. Exactly the same pattern Duty Desk and
//   Gatehouse each use for their own logins — fully independent, no
//   shared identity with either of them.
//
// - `ticketsDb` is a second connection to *Duty Desk's* project, used
//   exclusively for maintenance_tickets and maintenance_ticket_photos.
//   That table isn't copied or synced here — it's the same Postgres row
//   Duty Desk's own server reads and writes. Only code under
//   `src/lib/data/tickets.ts` should ever use this client, and only ever
//   against those two tables; nothing else in Duty Desk's database
//   (checklists, complaints, residents, its own staff_accounts) is ever
//   queried through it, even though the service-role key technically
//   could reach them.
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// SUPABASE_SCHEMA is optional and defaults to "public" — it only needs to be
// set if this project's tables ever move into a non-default schema (e.g. if
// Maintenance Desk is consolidated into Duty Desk's Supabase project to cut
// hosting costs, its tables would live under a "maintenance" schema there).
export const supabaseAdmin = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: process.env.SUPABASE_SCHEMA || "public" },
});

export const ticketsDb = createClient(getEnv("DUTY_DESK_SUPABASE_URL"), getEnv("DUTY_DESK_SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
