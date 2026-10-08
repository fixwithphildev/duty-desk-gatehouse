import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Names of everyone with a working account, for "assign to" suggestions.
export async function getActiveStaffNames(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("staff_accounts").select("display_name").eq("disabled", false).order("display_name");
  return [...new Set((data ?? []).map((s) => s.display_name as string))];
}
