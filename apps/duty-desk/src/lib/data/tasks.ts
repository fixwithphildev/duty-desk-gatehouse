import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface TaskRow {
  id: string;
  description: string;
  assigned_to: string | null;
  due_time: string | null;
  status: "Pending" | "Done";
  created_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getTasks(assignedToContains?: string): Promise<TaskRow[]> {
  let query = supabaseAdmin
    .from("tasks")
    .select("*, staff_accounts!tasks_voided_by_fkey(display_name)")
    .order("created_at", { ascending: false });
  if (assignedToContains) {
    query = query.ilike("assigned_to", `%${assignedToContains}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as TaskRow),
    voided_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? null,
  }));
}

export async function getPendingTasksCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "Pending");
  return count ?? 0;
}
