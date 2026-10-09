import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface LoginEventRow {
  id: string;
  username_attempted: string;
  success: boolean;
  reason: string | null;
  created_at: string;
}

export async function getRecentLoginEvents(limit = 25): Promise<LoginEventRow[]> {
  const { data } = await supabaseAdmin
    .from("login_events")
    .select("id, username_attempted, success, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as LoginEventRow[];
}

// Each username's latest successful sign-in, from the most recent 1000 sign-ins.
export async function getLastSignIns(): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin.from("login_events").select("username_attempted, created_at").eq("success", true).order("created_at", { ascending: false }).limit(1000);
  const out: Record<string, string> = {};
  for (const e of data ?? []) {
    const k = String(e.username_attempted).toLowerCase();
    if (!out[k]) out[k] = e.created_at as string;
  }
  return out;
}
