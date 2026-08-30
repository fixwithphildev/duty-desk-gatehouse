import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface ResidentRow {
  id: string;
  name: string;
  room: string;
  check_in: string | null;
  check_out: string | null;
  preferences: string | null;
  contact_info: string | null;
  notes: string | null;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getResidents(): Promise<ResidentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("resident_profiles")
    .select("*, staff_accounts!resident_profiles_voided_by_fkey(display_name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as ResidentRow),
    voided_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? null,
  }));
}
