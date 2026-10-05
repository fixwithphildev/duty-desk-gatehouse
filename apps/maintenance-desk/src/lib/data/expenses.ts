import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

// What Maintenance bought to fix each ticket. These rows live in THIS
// platform's own database (supabaseAdmin), not Duty Desk's — spending is
// Maintenance's own data. ticket_id points at a maintenance_tickets row in
// Duty Desk's project, so there's no foreign key; ticket details are looked
// up separately via getTicketSummaries() in lib/data/tickets.ts.

export interface ExpenseLine {
  id: string;
  ticket_id: string;
  item: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  supplier: string | null;
  purchased_on: string;
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
  supplier: string | null;
  purchasedOn: string;
}

const LINE_COLUMNS = "id, ticket_id, item, quantity, unit_cost, supplier, purchased_on, recorded_by_name, created_at, void, void_reason, voided_by_name";

function toLine(row: Record<string, unknown>): ExpenseLine {
  // Postgres numeric can come back as a string depending on precision —
  // coerce once here so nothing downstream has to care.
  const quantity = Number(row.quantity);
  const unitCost = Number(row.unit_cost);
  return {
    id: row.id as string,
    ticket_id: row.ticket_id as string,
    item: row.item as string,
    quantity,
    unit_cost: unitCost,
    line_total: Math.round(quantity * unitCost * 100) / 100,
    supplier: (row.supplier as string | null) ?? null,
    purchased_on: row.purchased_on as string,
    recorded_by_name: row.recorded_by_name as string,
    created_at: row.created_at as string,
    void: row.void as boolean,
    void_reason: (row.void_reason as string | null) ?? null,
    voided_by_name: (row.voided_by_name as string | null) ?? null,
  };
}

export interface TicketCostInfo {
  total: number;
  lineCount: number;
  noPurchase: boolean;
}

// Per-ticket cost totals for the tickets table. Void lines don't count.
export async function getCostInfoByTicket(): Promise<Record<string, TicketCostInfo>> {
  const [{ data: lines }, { data: noPurchase }] = await Promise.all([
    supabaseAdmin.from("ticket_expenses").select("ticket_id, quantity, unit_cost").eq("void", false),
    supabaseAdmin.from("ticket_no_purchase").select("ticket_id"),
  ]);
  const result: Record<string, TicketCostInfo> = {};
  for (const row of lines ?? []) {
    const info = (result[row.ticket_id] ??= { total: 0, lineCount: 0, noPurchase: false });
    info.total += Number(row.quantity) * Number(row.unit_cost);
    info.lineCount += 1;
  }
  for (const row of noPurchase ?? []) {
    (result[row.ticket_id] ??= { total: 0, lineCount: 0, noPurchase: false }).noPurchase = true;
  }
  for (const info of Object.values(result)) info.total = Math.round(info.total * 100) / 100;
  return result;
}

export async function getTicketExpenses(ticketId: string): Promise<ExpenseLine[]> {
  const { data } = await supabaseAdmin
    .from("ticket_expenses")
    .select(LINE_COLUMNS)
    .eq("ticket_id", ticketId)
    .order("purchased_on", { ascending: true })
    .order("created_at", { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map(toLine);
}

export async function addExpenses(ticketId: string, lines: NewExpenseLine[], recordedBy: { staffId: string; name: string }): Promise<void> {
  if (lines.length === 0) return;
  const { error } = await supabaseAdmin.from("ticket_expenses").insert(
    lines.map((l) => ({
      ticket_id: ticketId,
      item: l.item,
      quantity: l.quantity,
      unit_cost: l.unitCost,
      supplier: l.supplier,
      purchased_on: l.purchasedOn,
      recorded_by: recordedBy.staffId,
      recorded_by_name: recordedBy.name,
    }))
  );
  if (error) throw new Error(error.message);
  // A ticket that now has purchases is no longer a "nothing bought" fix.
  await supabaseAdmin.from("ticket_no_purchase").delete().eq("ticket_id", ticketId);
}

export async function markNoPurchase(ticketId: string, markedByName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ticket_no_purchase")
    .upsert({ ticket_id: ticketId, marked_by_name: markedByName, marked_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function voidExpense(id: string, reason: string, voidedByName: string): Promise<{ ticketId: string }> {
  const { data, error } = await supabaseAdmin
    .from("ticket_expenses")
    .update({ void: true, void_reason: reason, voided_by_name: voidedByName, voided_at: new Date().toISOString() })
    .eq("id", id)
    .select("ticket_id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Purchase line not found.");
  return { ticketId: data.ticket_id as string };
}

// Non-void purchases with purchased_on inside [from, to] (inclusive,
// YYYY-MM-DD) — the raw material for the spending reports.
export async function getExpensesInRange(from: string, to: string): Promise<ExpenseLine[]> {
  const rows: Array<Record<string, unknown>> = [];
  const PAGE = 1000;
  // PostgREST caps a single response at 1000 rows by default; page through
  // so a busy year isn't silently truncated.
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("ticket_expenses")
      .select(LINE_COLUMNS)
      .eq("void", false)
      .gte("purchased_on", from)
      .lte("purchased_on", to)
      .order("purchased_on", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Array<Record<string, unknown>>));
    if (!data || data.length < PAGE) break;
  }
  return rows.map(toLine);
}
