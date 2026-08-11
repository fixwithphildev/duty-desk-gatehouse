import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface PatrolRow {
  id: string;
  officer_name: string;
  route: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  status: "In Progress" | "Completed";
}

export async function getPatrols(): Promise<PatrolRow[]> {
  const { data } = await supabaseAdmin
    .from("patrols")
    .select("id, route, started_at, ended_at, notes, status, staff_accounts(display_name)")
    .order("started_at", { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    route: row.route as string,
    started_at: row.started_at as string,
    ended_at: row.ended_at as string | null,
    notes: row.notes as string | null,
    status: row.status as PatrolRow["status"],
    officer_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
  }));
}

export async function getActivePatrolsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("patrols").select("id", { count: "exact", head: true }).eq("status", "In Progress");
  return count ?? 0;
}
