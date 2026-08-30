import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface DutyLogRow {
  id: string;
  officer_id: string;
  officer_name: string;
  notes: string;
  handover: boolean;
  created_at: string;
  acknowledged_at: string | null;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getDutyLog(): Promise<DutyLogRow[]> {
  // Explicit FK names required on both joins — duty_log_entries now has
  // three foreign keys into staff_accounts (officer_id, acknowledged_by,
  // voided_by), so PostgREST can no longer infer which one a bare
  // "staff_accounts(display_name)" means and errors with PGRST201 ("more
  // than one relationship found").
  const { data, error } = await supabaseAdmin
    .from("duty_log_entries")
    .select(
      "id, officer_id, notes, handover, created_at, acknowledged_at, void, void_reason, voided_at, " +
        "staff_accounts!duty_log_entries_officer_id_fkey(display_name), voider:staff_accounts!duty_log_entries_voided_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    officer_id: row.officer_id as string,
    notes: row.notes as string,
    handover: row.handover as boolean,
    created_at: row.created_at as string,
    acknowledged_at: (row.acknowledged_at as string | null) ?? null,
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_at: row.voided_at as string | null,
    officer_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
    voided_by_name: (row.voider as { display_name?: string } | null)?.display_name ?? null,
  }));
}

// The dashboard only ever shows the most recent handover note that hasn't
// been marked as handled yet — once acknowledged (or voided as a mistake),
// it drops off for everyone.
export async function getLastHandover(): Promise<DutyLogRow | null> {
  const log = await getDutyLog();
  return log.find((d) => d.handover && !d.acknowledged_at && !d.void) ?? null;
}
