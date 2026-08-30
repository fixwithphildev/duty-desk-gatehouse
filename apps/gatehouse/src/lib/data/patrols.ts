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
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getPatrols(): Promise<PatrolRow[]> {
  // Explicit FK names — patrols has two foreign keys into staff_accounts
  // (officer_id and voided_by) now, so a bare "staff_accounts(display_name)"
  // is ambiguous to PostgREST.
  const { data, error } = await supabaseAdmin
    .from("patrols")
    .select(
      "id, route, started_at, ended_at, notes, status, void, void_reason, voided_at, " +
        "staff_accounts!patrols_officer_id_fkey(display_name), voider:staff_accounts!patrols_voided_by_fkey(display_name)"
    )
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    route: row.route as string,
    started_at: row.started_at as string,
    ended_at: row.ended_at as string | null,
    notes: row.notes as string | null,
    status: row.status as PatrolRow["status"],
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_at: row.voided_at as string | null,
    officer_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
    voided_by_name: (row.voider as { display_name?: string } | null)?.display_name ?? null,
  }));
}

export async function getActivePatrolsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("patrols").select("id", { count: "exact", head: true }).eq("status", "In Progress");
  return count ?? 0;
}
