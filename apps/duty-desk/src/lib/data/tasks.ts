import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface TaskRow {
  id: string;
  description: string;
  assigned_to: string | null;
  due_time: string | null;
  status: "Pending" | "Done";
  created_at: string;
}

export async function getTasks(assignedToContains?: string): Promise<TaskRow[]> {
  let query = supabaseAdmin.from("tasks").select("*").order("created_at", { ascending: false });
  if (assignedToContains) {
    query = query.ilike("assigned_to", `%${assignedToContains}%`);
  }
  const { data } = await query;
  return (data ?? []) as TaskRow[];
}

export async function getPendingTasksCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "Pending");
  return count ?? 0;
}
