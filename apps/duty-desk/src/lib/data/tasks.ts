import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface TaskRow {
  id: string;
  description: string;
  assigned_to: string | null;
  // The apartment the task is about, if any.
  apartment: string | null;
  due_time: string | null;
  status: "Pending" | "Done";
  created_at: string;
  created_by_name: string | null;
  done_at: string | null;
  done_by_name: string | null;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

const name = (v: unknown) => (v as { display_name?: string } | null)?.display_name ?? null;

export async function getTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select(
      "*, staff_accounts!tasks_voided_by_fkey(display_name), creator:staff_accounts!tasks_created_by_fkey(display_name), " +
        "doer:staff_accounts!tasks_done_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as TaskRow),
    done_at: (row.done_at as string | null) ?? null,
    apartment: (row.apartment as string | null) ?? null,
    created_by_name: name(row.creator),
    done_by_name: name(row.doer),
    voided_by_name: name(row.staff_accounts),
  }));
}

export async function getPendingTasksCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "Pending").eq("void", false);
  return count ?? 0;
}
