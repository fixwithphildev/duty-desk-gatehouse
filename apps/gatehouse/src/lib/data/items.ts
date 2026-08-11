import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface ItemLogRow {
  id: string;
  item_desc: string;
  carried_by: string;
  authorized_by: string | null;
  out_at: string;
  in_at: string | null;
  status: "Out" | "Returned";
}

export async function getItemLogs(): Promise<ItemLogRow[]> {
  const { data } = await supabaseAdmin.from("item_logs").select("*").order("out_at", { ascending: false });
  return (data ?? []) as ItemLogRow[];
}
