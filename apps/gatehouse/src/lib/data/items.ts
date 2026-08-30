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
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getItemLogs(): Promise<ItemLogRow[]> {
  const { data, error } = await supabaseAdmin
    .from("item_logs")
    .select("id, item_desc, carried_by, authorized_by, out_at, in_at, status, void, void_reason, voided_at, staff_accounts!item_logs_voided_by_fkey(display_name)")
    .order("out_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    item_desc: row.item_desc as string,
    carried_by: row.carried_by as string,
    authorized_by: row.authorized_by as string | null,
    out_at: row.out_at as string,
    in_at: row.in_at as string | null,
    status: row.status as ItemLogRow["status"],
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_at: row.voided_at as string | null,
    voided_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? null,
  }));
}
