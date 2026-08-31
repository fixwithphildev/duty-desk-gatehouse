"use client";

import { useState, useTransition } from "react";
import { Plus, Ban } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { addResidentAction, voidResidentAction } from "./actions";
import type { ResidentRow } from "@/lib/data/residents";

const EMPTY = { name: "", room: "", checkIn: "", checkOut: "", preferences: "", contactInfo: "", notes: "" };

export function ResidentsClient({ residents, canEdit, canVoid }: { residents: ResidentRow[]; canEdit: boolean; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<ResidentRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const submit = () => {
    if (!form.name.trim() || !form.room.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addResidentAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const submitVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidResidentAction(voidTarget.id, voidReason);
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
        <h2>Resident Records</h2>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> Add resident
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Preferences</th></tr></thead>
          <tbody>
            {residents.map((r) => (
              <tr key={r.id} style={r.void ? { opacity: 0.6 } : undefined}>
                <td className="cell-title" data-label="Name">
                  {r.name}
                  {r.void ? (
                    <div className="cell-sub" style={{ color: "var(--red)" }}>Voided by {r.voided_by_name} — {r.void_reason}</div>
                  ) : canVoid ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { setVoidTarget(r); setVoidReason(""); setVoidError(null); }}>
                      <Ban size={12} /> Void
                    </button>
                  ) : null}
                </td>
                <td data-label="Room">{r.room}</td>
                <td className="mono" data-label="Check-in">{r.check_in ?? "—"}</td>
                <td className="mono" data-label="Check-out">{r.check_out ?? "—"}</td>
                <td className="cell-sub" data-label="Preferences">{r.preferences ?? "—"}</td>
              </tr>
            ))}
            {residents.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", opacity: 0.75 }}>No resident records yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Add a resident record">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Room"><input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></Field>
        <Field label="Check-in date"><input className="input" type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} /></Field>
        <Field label="Check-out date"><input className="input" type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} /></Field>
        <Field label="Preferences"><textarea className="textarea" rows={3} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} /></Field>
        <Field label="Contact info"><input className="input" value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} /></Field>
        <Field label="Notes"><textarea className="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.name.trim() || !form.room.trim() || pending} onClick={submit}>
          {pending ? "Saving…" : "Save resident"}
        </button>
      </Drawer>

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this resident record">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 0 }}>This keeps the original entry visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.name} — {voidTarget.room}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Entered against the wrong room" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void record"}
        </button>
      </Drawer>
    </div>
  );
}
