import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface DutyLogRow {
  id: string;
  officer_id: string;
  officer_name: string;
  notes: string;
  handover: boolean;
  created_at: string;
}

export async function getDutyLog(): Promise<DutyLogRow[]> {
  const { data } = await supabaseAdmin
    .from("duty_log_entries")
    .select("id, officer_id, notes, handover, created_at, staff_accounts(display_name)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    officer_id: row.officer_id as string,
    notes: row.notes as string,
    handover: row.handover as boolean,
    created_at: row.created_at as string,
    officer_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
  }));
}

export async function getLastHandover(): Promise<DutyLogRow | null> {
  const log = await getDutyLog();
  return log.find((d) => d.handover) ?? null;
}
