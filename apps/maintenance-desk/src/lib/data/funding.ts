import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { Funding, FundingTx, TxKind } from "@/lib/funding";

// Money from Finance, per job (maintenance.ticket_funding and
// maintenance.funding_transactions).
export async function getFunding(): Promise<Map<string, Funding>> {
  const [{ data: needs, error: e1 }, { data: txs, error: e2 }] = await Promise.all([
    supabaseAdmin.from("ticket_funding").select("ticket_id, amount_needed, balance_requested_at, balance_requested_amount"),
    supabaseAdmin
      .from("funding_transactions")
      .select("id, ticket_id, kind, amount, tx_date, reference, finance_officer, pays_back, recorded_by_name, void")
      .order("tx_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const out = new Map<string, Funding>();
  for (const n of needs ?? []) {
    out.set(n.ticket_id as string, {
      need: Number(n.amount_needed),
      balanceRequestedAt: (n.balance_requested_at as string | null) ?? null,
      balanceRequestedAmount: n.balance_requested_amount == null ? null : Number(n.balance_requested_amount),
      tx: [],
    });
  }
  for (const t of (txs ?? []) as Array<Record<string, unknown>>) {
    const id = t.ticket_id as string;
    const f = out.get(id) ?? { need: 0, balanceRequestedAt: null, balanceRequestedAmount: null, tx: [] };
    f.tx.push({ ...(t as unknown as FundingTx), amount: Number(t.amount) });
    out.set(id, f);
  }
  return out;
}

export async function setAmountNeeded(ticketId: string, amount: number, byName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ticket_funding")
    .upsert({ ticket_id: ticketId, amount_needed: amount, updated_by_name: byName, updated_at: new Date().toISOString() }, { onConflict: "ticket_id" });
  if (error) throw new Error(error.message);
}

export async function addFundingTx(
  ticketId: string,
  tx: { kind: TxKind; amount: number; date: string; reference: string | null; financeOfficer: string | null; paysBack: string | null },
  recordedBy: { staffId: string; name: string }
): Promise<void> {
  const { error } = await supabaseAdmin.from("funding_transactions").insert({
    ticket_id: ticketId,
    kind: tx.kind,
    amount: tx.amount,
    tx_date: tx.date,
    reference: tx.reference,
    finance_officer: tx.financeOfficer,
    pays_back: tx.paysBack,
    recorded_by: recordedBy.staffId,
    recorded_by_name: recordedBy.name,
  });
  if (error) throw new Error(error.message);
  // Once the balance is paid, the request for it is settled.
  if (tx.kind === "balance") {
    await supabaseAdmin.from("ticket_funding").update({ balance_requested_at: null, balance_requested_amount: null }).eq("ticket_id", ticketId);
  }
}

export async function requestBalance(ticketId: string, amount: number, byName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ticket_funding")
    .update({ balance_requested_at: new Date().toISOString(), balance_requested_amount: amount, balance_requested_by_name: byName })
    .eq("ticket_id", ticketId);
  if (error) throw new Error(error.message);
}

export async function voidFundingTx(id: string, reason: string, byName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("funding_transactions")
    .update({ void: true, void_reason: reason, voided_by_name: byName, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
