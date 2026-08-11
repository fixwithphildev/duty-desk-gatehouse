import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface KeyRecordRow {
  id: string;
  key_type: string;
  area: string;
  issued_to: string;
  issued_at: string;
  returned_at: string | null;
  status: "Issued" | "Returned" | "Lost";
}

export async function getKeyRecords(): Promise<KeyRecordRow[]> {
  const { data } = await supabaseAdmin.from("key_records").select("*").order("issued_at", { ascending: false });
  return (data ?? []) as KeyRecordRow[];
}

export async function getIssuedKeysCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("key_records").select("id", { count: "exact", head: true }).eq("status", "Issued");
  return count ?? 0;
}
