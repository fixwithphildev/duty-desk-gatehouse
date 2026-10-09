import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// A patrol: an officer walks a route, then finishes it with notes.
export interface Patrol {
  id: string;
  officer_id: string | null;
  officer_name: string;
  route: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  status: "In Progress" | "Completed";
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
}

// Explicit FK names: patrols has two foreign keys into staff_accounts
// (officer_id and voided_by), so a bare join is ambiguous to PostgREST.
const COLS =
  "id, officer_id, route, started_at, ended_at, notes, status, void, void_reason, " +
  "officer:staff_accounts!patrols_officer_id_fkey(display_name), voider:staff_accounts!patrols_voided_by_fkey(display_name)";

const name = (v: unknown) => (v as { display_name?: string } | null)?.display_name ?? null;

export async function getPatrols(): Promise<Patrol[]> {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("patrols").select(COLS).order("started_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < 1000) break;
  }
  return rows.map((r) => ({
    id: r.id as string,
    officer_id: (r.officer_id as string | null) ?? null,
    officer_name: name(r.officer) ?? "—",
    route: r.route as string,
    started_at: r.started_at as string,
    ended_at: (r.ended_at as string | null) ?? null,
    notes: (r.notes as string | null) || null,
    status: r.status as Patrol["status"],
    void: !!r.void,
    void_reason: (r.void_reason as string | null) ?? null,
    voided_by_name: name(r.voider),
  }));
}

export async function startPatrol(route: string, officerId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("patrols").insert({ officer_id: officerId, route, status: "In Progress" });
  if (error) throw new Error(error.message);
}

export async function finishPatrol(id: string, notes: string | null): Promise<void> {
  const { error } = await supabaseAdmin.from("patrols").update({ status: "Completed", ended_at: new Date().toISOString(), notes }).eq("id", id).eq("status", "In Progress");
  if (error) throw new Error(error.message);
}

export async function voidPatrol(id: string, reason: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("patrols").update({ void: true, void_reason: reason, voided_by: staffId, voided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
