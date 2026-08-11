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
}

export async function getResidents(): Promise<ResidentRow[]> {
  const { data } = await supabaseAdmin.from("resident_profiles").select("*").order("created_at", { ascending: false });
  return (data ?? []) as ResidentRow[];
}
