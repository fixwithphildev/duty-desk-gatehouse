import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service-role key. This key bypasses
// Row Level Security, so it must never be sent to the browser — only import
// this file from Server Components, Server Actions, or Route Handlers.
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// SUPABASE_SCHEMA is optional and defaults to "public" — it only needs to be
// set if this project's tables ever move into a non-default schema (e.g. if
// Gatehouse is consolidated into Duty Desk's Supabase project to cut hosting
// costs, its tables would live under a "gatehouse" schema there instead).
export const supabaseAdmin = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: process.env.SUPABASE_SCHEMA || "public" },
});
