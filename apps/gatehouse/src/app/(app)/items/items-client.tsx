"use client";

import { useState, useTransition } from "react";
import { Plus, DoorOpen, Ban } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { statusTone } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { logItemOutAction, markItemReturnedAction, voidItemLogAction } from "./actions";
import type { ItemLogRow } from "@/lib/data/items";

function fmtTime(iso: string | null): string {
  return !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { itemDesc: "", carriedBy: "", authorizedBy: "" };

export function ItemsClient({ logs, canEdit, canVoid }: { logs: ItemLogRow[]; canEdit: boolean; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<ItemLogRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const outItems = logs.filter((i) => i.status === "Out");
  const history = logs.filter((i) => i.status !== "Out");

  const submit = () => {
    if (!form.itemDesc.trim() || !form.carriedBy.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await logItemOutAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const markReturned = (id: string) => startTransition(async () => { await markItemReturnedAction(id); });

  const submitVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidItemLogAction(voidTarget.id, voidReason);
        setVoidTarget(null);
        setVoidReason("");
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setVoidError(errorMessage(e));
      }
    });
  };

  return (
    <div className="view">
      <div className="view-head">
        <h2>Items Book</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Log item out</button> : null}
      </div>

      <div className="card">
        <div className="card-head"><span>Currently out ({outItems.length})</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th>Carried by</th><th>Authorized by</th><th>Out since</th><th /></tr></thead>
            <tbody>
              {outItems.map((i) => (
                <tr key={i.id}>
                  <td className="cell-title" data-label="Item">{i.item_desc}</td>
                  <td data-label="Carried by">{i.carried_by}</td>
                  <td data-label="Authorized by">{i.authorized_by || "—"}</td>
                  <td className="mono" data-label="Out since">{fmtTime(i.out_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {canEdit ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => markReturned(i.id)}><DoorOpen size={13} /> Mark returned</button> : null}
                      {canVoid ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { setVoidTarget(i); setVoidReason(""); setVoidError(null); }}><Ban size={13} /> Void</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {outItems.length === 0 ? <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>Nothing currently out.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>History</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th>Carried by</th><th>Out</th><th>In</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((i) => (
                <tr key={i.id} style={i.void ? { opacity: 0.6 } : undefined}>
                  <td className="cell-title" data-label="Item">
                    {i.item_desc}
                    {i.void ? (
                      <div className="cell-sub" style={{ color: "var(--red)" }}>Voided by {i.voided_by_name} — {i.void_reason}</div>
                    ) : canVoid ? (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { setVoidTarget(i); setVoidReason(""); setVoidError(null); }}><Ban size={12} /> Void</button>
                    ) : null}
                  </td>
                  <td data-label="Carried by">{i.carried_by}</td>
                  <td className="mono" data-label="Out">{fmtTime(i.out_at)}</td>
                  <td className="mono" data-label="In">{fmtTime(i.in_at)}</td>
                  <td data-label="Status">{i.void ? <Badge tone="neutral">Voided</Badge> : <Badge tone={statusTone(i.status)}>{i.status}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Log an item out">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Item description"><input className="input" value={form.itemDesc} onChange={(e) => setForm({ ...form, itemDesc: e.target.value })} placeholder="e.g. Company laptop, tag #IT-042" /></Field>
        <Field label="Carried by"><input className="input" value={form.carriedBy} onChange={(e) => setForm({ ...form, carriedBy: e.target.value })} /></Field>
        <Field label="Authorized by"><input className="input" value={form.authorizedBy} onChange={(e) => setForm({ ...form, authorizedBy: e.target.value })} placeholder="Optional" /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.itemDesc.trim() || !form.carriedBy.trim() || pending} onClick={submit}>
          {pending ? "Logging…" : "Log item out"}
        </button>
      </Drawer>

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this entry">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p className="gate-copy" style={{ marginTop: 0 }}>This keeps the original entry visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.item_desc}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Logged against the wrong item" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void entry"}
        </button>
      </Drawer>
    </div>
  );
}
