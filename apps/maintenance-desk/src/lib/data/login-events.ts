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
