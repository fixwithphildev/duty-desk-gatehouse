import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// Names of everyone with a working account, for "assign to" suggestions.
export async function getActiveStaffNames(): Promise<string[]> {
  const { data } = await supabaseAdmin.from("staff_accounts").select("display_name").eq("disabled", false).order("display_name");
  return [...new Set((data ?? []).map((s) => s.display_name as string))];
}

// People a task can be given to: Resident Officers by name first, then
// everyone else with a working account (not the Admin's IT account).
export async function getTaskPeople(): Promise<{ officers: string[]; others: string[] }> {
  const { data } = await supabaseAdmin.from("staff_accounts").select("display_name, role").eq("disabled", false).order("display_name");
  const rows = (data ?? []) as { display_name: string; role: string }[];
  const officers = [...new Set(rows.filter((r) => r.role === "resident_officer").map((r) => r.display_name))];
  const others = [...new Set(rows.filter((r) => r.role !== "resident_officer" && r.role !== "super_admin").map((r) => r.display_name))].filter((n) => !officers.includes(n));
  return { officers, others };
}
