import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// The items book: anything carried out through the gate (tools, equipment,
// furniture) and who authorised it, until it's booked back in.
export interface ItemLog {
  id: string;
  item: string;
  carried_by: string;
  authorized_by: string | null;
  out_at: string;
  in_at: string | null;
  status: "Out" | "Returned";
  logged_by_name: string | null;
  in_by_name: string | null;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
}

const COLS =
  "id, item_desc, carried_by, authorized_by, out_at, in_at, status, void, void_reason, " +
  "logger:staff_accounts!item_logs_logged_by_fkey(display_name), inner_by:staff_accounts!item_logs_in_logged_by_fkey(display_name), " +
  "voider:staff_accounts!item_logs_voided_by_fkey(display_name)";

const name = (v: unknown) => (v as { display_name?: string } | null)?.display_name ?? null;

function toItem(r: Record<string, unknown>): ItemLog {
  return {
    id: r.id as string,
    item: r.item_desc as string,
    carried_by: r.carried_by as string,
    authorized_by: (r.authorized_by as string | null) || null,
    out_at: r.out_at as string,
    in_at: (r.in_at as string | null) ?? null,
    status: r.status as ItemLog["status"],
    logged_by_name: name(r.logger),
    in_by_name: name(r.inner_by),
    void: !!r.void,
    void_reason: (r.void_reason as string | null) ?? null,
    voided_by_name: name(r.voider),
  };
}

export async function getItemLogs(): Promise<ItemLog[]> {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("item_logs").select(COLS).order("out_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < 1000) break;
  }
  return rows.map(toItem);
}

export async function logItemOut(input: { item: string; carriedBy: string; authorizedBy: string | null }, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("item_logs")
    .insert({ item_desc: input.item, carried_by: input.carriedBy, authorized_by: input.authorizedBy, status: "Out", logged_by: staffId });
  if (error) throw new Error(error.message);
}

export async function bookItemIn(id: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("item_logs")
    .update({ status: "Returned", in_at: new Date().toISOString(), in_logged_by: staffId })
    .eq("id", id)
    .eq("status", "Out");
  if (error) throw new Error(error.message);
}

export async function voidItemLog(id: string, reason: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("item_logs").update({ void: true, void_reason: reason, voided_by: staffId, voided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
