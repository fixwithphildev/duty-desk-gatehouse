import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

// What each unit bought (the Costs page). A purchase is for a job (a Ticket
// Board ticket or a request, by ticket_id) or stock the unit keeps in its
// store (no ticket_id). Lines of one receipt share a receipt_id. These rows
// live in the maintenance schema; ticket details are joined in code.

export interface ExpenseLine {
  id: string;
  ticket_id: string | null;
  unit: string | null;
  receipt_id: string | null;
  item: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  supplier: string | null;
  purchased_on: string; // YYYY-MM-DD, the day it was bought
  recorded_by_name: string;
  created_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
}

export interface NewExpenseLine {
  item: string;
  quantity: number;
  unitCost: number;
}

const LINE_COLUMNS = "id, ticket_id, unit, receipt_id, item, quantity, unit_cost, supplier, purchased_on, recorded_by_name, created_at, void, void_reason, voided_by_name";

function toLine(row: Record<string, unknown>): ExpenseLine {
  // Postgres numeric can come back as a string; coerce once here.
  const quantity = Number(row.quantity), unitCost = Number(row.unit_cost);
  return {
    ...(row as unknown as ExpenseLine),
    ticket_id: (row.ticket_id as string | null) ?? null,
    unit: (row.unit as string | null) ?? null,
    receipt_id: (row.receipt_id as string | null) ?? null,
    quantity,
    unit_cost: unitCost,
    line_total: Math.round(quantity * unitCost * 100) / 100,
    supplier: (row.supplier as string | null) ?? null,
    void_reason: (row.void_reason as string | null) ?? null,
    voided_by_name: (row.voided_by_name as string | null) ?? null,
  };
}

// Every purchase line, newest first, paged past PostgREST's 1000-row cap.
export async function getExpenses(opts: { from?: string; to?: string; includeVoid?: boolean } = {}): Promise<ExpenseLine[]> {
  const rows: Array<Record<string, unknown>> = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    let q = supabaseAdmin.from("ticket_expenses").select(LINE_COLUMNS);
    if (!opts.includeVoid) q = q.eq("void", false);
    if (opts.from) q = q.gte("purchased_on", opts.from);
    if (opts.to) q = q.lte("purchased_on", opts.to);
    const { data, error } = await q.order("purchased_on", { ascending: false }).order("created_at", { ascending: false }).range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Array<Record<string, unknown>>));
    if (!data || data.length < PAGE) break;
  }
  return rows.map(toLine);
}

export async function getNoPurchaseIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin.from("ticket_no_purchase").select("ticket_id");
  return new Set((data ?? []).map((r) => r.ticket_id as string));
}

// One receipt: any number of items, for a job or for the unit's stock.
export async function addPurchase(
  input: { unit: string; ticketId: string | null; supplier: string | null; purchasedOn: string; lines: NewExpenseLine[] },
  recordedBy: { staffId: string; name: string }
): Promise<void> {
  if (input.lines.length === 0) return;
  const receiptId = randomUUID();
  const { error } = await supabaseAdmin.from("ticket_expenses").insert(
    input.lines.map((l) => ({
      ticket_id: input.ticketId,
      unit: input.unit,
      receipt_id: receiptId,
      item: l.item,
      quantity: l.quantity,
      unit_cost: l.unitCost,
      supplier: input.supplier,
      purchased_on: input.purchasedOn,
      recorded_by: recordedBy.staffId,
      recorded_by_name: recordedBy.name,
    }))
  );
  if (error) throw new Error(error.message);
  // A job that now has purchases is no longer a "nothing bought" fix.
  if (input.ticketId) await supabaseAdmin.from("ticket_no_purchase").delete().eq("ticket_id", input.ticketId);
}

export async function markNoPurchase(ticketId: string, markedByName: string): Promise<void> {
  const { error } = await supabaseAdmin.from("ticket_no_purchase").upsert({ ticket_id: ticketId, marked_by_name: markedByName, marked_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function voidExpense(id: string, reason: string, voidedByName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ticket_expenses")
    .update({ void: true, void_reason: reason, voided_by_name: voidedByName, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
