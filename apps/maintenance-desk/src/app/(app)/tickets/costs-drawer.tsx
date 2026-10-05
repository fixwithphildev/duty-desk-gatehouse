"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Ban } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { formatNaira } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import type { MaintenanceTicketRow } from "@/lib/data/tickets";
import type { ExpenseLine } from "@/lib/data/expenses";
import { addTicketExpensesAction, getTicketExpensesAction, resolveTicketAction, voidExpenseAction } from "./actions";

// "resolve": opened by switching a ticket's status to Resolved — the
// ticket only becomes Resolved once this form is submitted.
// "view": opened from a ticket's Cost button — see what was bought, add
// late receipts, and (Supervisor/Super Admin) void a wrong line.
export type CostsMode = "resolve" | "view";

interface DraftLine {
  key: number;
  item: string;
  quantity: string;
  unitCost: string;
  supplier: string;
  purchasedOn: string;
}

// The property's date, not the device's — a tablet left on the wrong
// timezone shouldn't default purchases to tomorrow.
function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

let nextKey = 1;
function blankLine(): DraftLine {
  return { key: nextKey++, item: "", quantity: "1", unitCost: "", supplier: "", purchasedOn: todayLocal() };
}

function draftTotal(l: DraftLine): number {
  const q = Number(l.quantity);
  const c = Number(l.unitCost);
  return Number.isFinite(q) && Number.isFinite(c) ? q * c : 0;
}

function isBlank(l: DraftLine): boolean {
  return !l.item.trim() && !l.unitCost.trim() && !l.supplier.trim();
}

export function CostsDrawer({
  ticket,
  mode,
  canEdit,
  canVoid,
  onClose,
}: {
  ticket: MaintenanceTicketRow | null;
  mode: CostsMode;
  canEdit: boolean;
  canVoid: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExpenseLine[] | null>(null);
  const [drafts, setDrafts] = useState<DraftLine[]>([]);
  const [noPurchase, setNoPurchase] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const ticketId = ticket?.id ?? null;

  useEffect(() => {
    if (!ticketId) return;
    setError(null);
    setExisting(null);
    setNoPurchase(false);
    setVoidingId(null);
    setDrafts(mode === "resolve" ? [blankLine()] : []);
    let cancelled = false;
    getTicketExpensesAction(ticketId).then((lines) => { if (!cancelled) setExisting(lines); });
    return () => { cancelled = true; };
  }, [ticketId, mode]);

  const reload = async () => {
    if (ticketId) setExisting(await getTicketExpensesAction(ticketId));
  };

  const filled = drafts.filter((l) => !isBlank(l));
  const activeExisting = (existing ?? []).filter((l) => !l.void);
  const existingTotal = activeExisting.reduce((sum, l) => sum + l.line_total, 0);
  const draftsSum = filled.reduce((sum, l) => sum + draftTotal(l), 0);

  const update = (key: number, patch: Partial<DraftLine>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const payload = () =>
    filled.map((l) => ({ item: l.item, quantity: l.quantity, unitCost: l.unitCost, supplier: l.supplier, purchasedOn: l.purchasedOn }));

  const submit = () => {
    if (!ticket) return;
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "resolve") {
          await resolveTicketAction(ticket.id, { lines: payload(), noPurchase: filled.length === 0 && noPurchase });
          onClose();
        } else {
          await addTicketExpensesAction(ticket.id, payload());
          setDrafts([]);
          await reload();
        }
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const confirmVoid = () => {
    if (!voidingId || !voidReason.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await voidExpenseAction(voidingId, voidReason);
        setVoidingId(null);
        setVoidReason("");
        await reload();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  // A reopened ticket that already has purchases can be resolved again
  // without adding more — its costs are already on record.
  const hasExisting = activeExisting.length > 0;
  const canSubmitResolve = filled.length > 0 || noPurchase || hasExisting;

  return (
    <Drawer
      open={!!ticket}
      onClose={onClose}
      title={mode === "resolve" ? "Resolve — what was bought?" : "Costs for this ticket"}
    >
      {ticket ? <p className="costs-ticket">{ticket.issue_type} — {ticket.area}</p> : null}
      {error ? <div className="login-error">{error}</div> : null}

      {existing === null ? (
        <p className="costs-hint">Loading…</p>
      ) : existing.length > 0 ? (
        <div className="costs-existing">
          <div className="costs-section-label">Already recorded</div>
          {existing.map((l) => (
            <div key={l.id} className={`costs-row ${l.void ? "costs-row-void" : ""}`}>
              <div className="costs-row-main">
                <div className="costs-row-item">{l.item}</div>
                <div className="costs-row-meta">
                  {l.quantity} × {formatNaira(l.unit_cost)} · {l.purchased_on}
                  {l.supplier ? ` · ${l.supplier}` : ""} · {l.recorded_by_name}
                </div>
                {l.void ? <div className="costs-row-void-note">Voided by {l.voided_by_name} — {l.void_reason}</div> : null}
                {voidingId === l.id ? (
                  <div className="costs-void-form">
                    <input className="input" autoFocus value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason, e.g. entered twice" />
                    <div className="costs-void-actions">
                      <button type="button" className="btn btn-sm btn-danger" disabled={!voidReason.trim() || pending} onClick={confirmVoid}>Void line</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setVoidingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="costs-row-side">
                <span className="mono costs-row-amount">{formatNaira(l.line_total)}</span>
                {canVoid && !l.void && voidingId !== l.id ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVoidingId(l.id); setVoidReason(""); }}>
                    <Ban size={12} /> Void
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <div className="costs-total"><span>Total so far</span><span className="mono">{formatNaira(existingTotal)}</span></div>
        </div>
      ) : mode === "view" ? (
        <p className="costs-hint">Nothing recorded for this ticket yet.</p>
      ) : null}

      {canEdit && (mode === "resolve" || drafts.length > 0) ? (
        <div className="costs-drafts">
          {hasExisting || mode === "view" ? <div className="costs-section-label">Add items</div> : null}
          {drafts.map((l, i) => (
            <div key={l.key} className="costs-draft">
              <div className="costs-draft-head">
                <span>Item {i + 1}</span>
                {drafts.length > 1 || mode === "view" ? (
                  <button type="button" className="icon-btn" aria-label="Remove item" onClick={() => setDrafts((ds) => ds.filter((d) => d.key !== l.key))}>
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
              <Field label="What was bought">
                <input className="input" value={l.item} onChange={(e) => { update(l.key, { item: e.target.value }); setNoPurchase(false); }} placeholder="e.g. PVC pipe, ceiling fan capacitor" />
              </Field>
              <div className="costs-draft-grid">
                <Field label="Quantity">
                  <input className="input" type="number" inputMode="decimal" min="0" step="any" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} />
                </Field>
                <Field label="Unit cost (₦)">
                  <input className="input" type="number" inputMode="decimal" min="0" step="any" value={l.unitCost} onChange={(e) => { update(l.key, { unitCost: e.target.value }); setNoPurchase(false); }} placeholder="0.00" />
                </Field>
              </div>
              <div className="costs-draft-grid">
                <Field label="Date bought">
                  <input className="input" type="date" max={todayLocal()} value={l.purchasedOn} onChange={(e) => update(l.key, { purchasedOn: e.target.value })} />
                </Field>
                <Field label="Supplier (optional)">
                  <input className="input" value={l.supplier} onChange={(e) => update(l.key, { supplier: e.target.value })} placeholder="e.g. Ikeja market" />
                </Field>
              </div>
              <div className="costs-line-total">Line total <span className="mono">{formatNaira(draftTotal(l))}</span></div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafts((ds) => [...ds, blankLine()])}>
            <Plus size={13} /> Add another item
          </button>
          {filled.length > 0 ? (
            <div className="costs-total"><span>{hasExisting ? "Adding" : "Total"}</span><span className="mono">{formatNaira(draftsSum)}</span></div>
          ) : null}
        </div>
      ) : null}

      {mode === "resolve" && canEdit ? (
        <>
          {filled.length === 0 && !hasExisting ? (
            <label className="checkbox-row costs-no-purchase">
              <input type="checkbox" checked={noPurchase} onChange={(e) => setNoPurchase(e.target.checked)} />
              No purchase needed — fixed with what we already had
            </label>
          ) : null}
          <button type="button" className="btn btn-primary drawer-submit" disabled={!canSubmitResolve || pending} onClick={submit}>
            {pending ? "Saving…" : "Resolve ticket"}
          </button>
        </>
      ) : null}

      {mode === "view" && canEdit ? (
        drafts.length === 0 ? (
          <button type="button" className="btn drawer-submit" onClick={() => setDrafts([blankLine()])}>
            <Plus size={14} /> Add items bought
          </button>
        ) : (
          <button type="button" className="btn btn-primary drawer-submit" disabled={filled.length === 0 || pending} onClick={submit}>
            {pending ? "Saving…" : "Save items"}
          </button>
        )
      ) : null}
    </Drawer>
  );
}
