"use client";

import { useState, useTransition } from "react";
import { Plus, Ban } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { DD_COMPLAINT_CATEGORIES, DD_COMPLAINT_STATUSES, DD_PRIORITIES, priorityTone } from "@/lib/checklist-data";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createComplaintAction, updateComplaintStatusAction, voidComplaintAction } from "./actions";
import type { ComplaintRow } from "@/lib/data/complaints";
import { Badge } from "@/components/ui";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type PriorityValue = "Low" | "Medium" | "High";
const EMPTY: { guestName: string; room: string; category: string; priority: PriorityValue; description: string } = {
  guestName: "",
  room: "",
  category: DD_COMPLAINT_CATEGORIES[0],
  priority: "Medium",
  description: "",
};

export function ComplaintsClient({ complaints, canEdit, canVoid }: { complaints: ComplaintRow[]; canEdit: boolean; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<ComplaintRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const submit = () => {
    if (!form.description.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createComplaintAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const onStatusChange = (id: string, status: "Open" | "In Progress" | "Resolved") => {
    startTransition(async () => {
      await updateComplaintStatusAction(id, status);
    });
  };

  const submitVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidComplaintAction(voidTarget.id, voidReason);
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
        <h2>Guest &amp; Resident Complaints</h2>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> Log complaint
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Logged</th><th>Guest</th><th>Room</th><th>Category</th><th>Priority</th><th>Details</th><th>Status</th></tr></thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id} style={c.void ? { opacity: 0.6 } : undefined}>
                <td className="mono" data-label="Logged">{fmtTime(c.created_at)}</td>
                <td data-label="Guest">{c.guest_name || "—"}</td>
                <td data-label="Room">{c.room || "—"}</td>
                <td data-label="Category">{c.category}</td>
                <td data-label="Priority"><Badge tone={priorityTone(c.priority)}>{c.priority}</Badge></td>
                <td className="cell-sub" data-label="Details">
                  {c.description}
                  {c.void ? (
                    <div style={{ color: "var(--red)", marginTop: 4 }}>Voided by {c.voided_by_name} — {c.void_reason}</div>
                  ) : canVoid ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { setVoidTarget(c); setVoidReason(""); setVoidError(null); }}>
                      <Ban size={12} /> Void
                    </button>
                  ) : null}
                </td>
                <td data-label="Status">
                  {c.void ? (
                    <Badge tone="neutral">Voided</Badge>
                  ) : canEdit ? (
                    <select
                      className="select select-sm"
                      value={c.status}
                      disabled={pending}
                      onChange={(e) => onStatusChange(c.id, e.target.value as typeof c.status)}
                    >
                      {DD_COMPLAINT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge tone={c.status === "Resolved" ? "teal" : "gold"}>{c.status}</Badge>
                  )}
                </td>
              </tr>
            ))}
            {complaints.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", opacity: 0.75 }}>No complaints logged yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Log a complaint / request">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Guest / resident name">
          <input className="input" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
        </Field>
        <Field label="Room / apartment">
          <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
        </Field>
        <Field label="Category">
          <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {DD_COMPLAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <div className="seg">
            {DD_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`seg-btn tone-${priorityTone(p)} ${form.priority === p ? "seg-active" : ""}`}
                onClick={() => setForm({ ...form, priority: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Details">
          <textarea className="textarea" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.description.trim() || pending} onClick={submit}>
          {pending ? "Saving…" : "Save"}
        </button>
      </Drawer>

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this complaint">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 0 }}>This keeps the original entry visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.description}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Logged against the wrong room" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void complaint"}
        </button>
      </Drawer>
    </div>
  );
}
