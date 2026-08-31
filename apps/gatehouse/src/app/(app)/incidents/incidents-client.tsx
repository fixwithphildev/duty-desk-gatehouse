"use client";

import { useState, useTransition } from "react";
import { Plus, Ban } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { GH_SEVERITIES, severityTone } from "@/lib/types";
import { GH_INCIDENT_CATEGORIES, GH_INCIDENT_STATUSES } from "@/lib/constants";
import type { IncidentRow } from "@/lib/data/incidents";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createIncidentAction, updateIncidentStatusAction, voidIncidentAction } from "./actions";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { title: "", category: GH_INCIDENT_CATEGORIES[0], severity: "Low", location: "", description: "" };

export function IncidentsClient({ incidents, canEdit, canVoid }: { incidents: IncidentRow[]; canEdit: boolean; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<IncidentRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const submit = () => {
    if (!form.title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createIncidentAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const onStatusChange = (id: string, status: (typeof GH_INCIDENT_STATUSES)[number]) =>
    startTransition(async () => { await updateIncidentStatusAction(id, status); });

  const submitVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidIncidentAction(voidTarget.id, voidReason);
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
        <h2>Incidents</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Log incident</button> : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Reported</th><th>Title</th><th>Category</th><th>Severity</th><th>Location</th><th>Status</th></tr></thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id} style={i.void ? { opacity: 0.6 } : undefined}>
                <td className="mono" data-label="Reported">{fmtTime(i.created_at)}</td>
                <td className="cell-title" data-label="Title">
                  {i.title}
                  {i.void ? (
                    <div className="cell-sub" style={{ color: "var(--red)" }}>
                      Voided by {i.voided_by_name}{i.voided_at ? ` · ${fmtTime(i.voided_at)}` : ""} — {i.void_reason}
                    </div>
                  ) : canVoid ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { setVoidTarget(i); setVoidReason(""); setVoidError(null); }}>
                      <Ban size={12} /> Void
                    </button>
                  ) : null}
                </td>
                <td data-label="Category">{i.category}</td>
                <td data-label="Severity"><Badge tone={severityTone(i.severity)}>{i.severity}</Badge></td>
                <td data-label="Location">{i.location || "—"}</td>
                <td data-label="Status">
                  {i.void ? (
                    <Badge tone="neutral">Voided</Badge>
                  ) : canEdit ? (
                    <select className="select select-sm" value={i.status} disabled={pending} onChange={(e) => onStatusChange(i.id, e.target.value as typeof i.status)}>
                      {GH_INCIDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge tone={i.status === "Resolved" ? "green" : "amber"}>{i.status}</Badge>
                  )}
                </td>
              </tr>
            ))}
            {incidents.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>No incidents logged yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Log an incident">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Category">
          <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {GH_INCIDENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <div className="seg">
            {GH_SEVERITIES.map((s) => (
              <button key={s} type="button" className={`seg-btn tone-${severityTone(s)} ${form.severity === s ? "seg-active" : ""}`} onClick={() => setForm({ ...form, severity: s })}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="Location"><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        <Field label="Details"><textarea className="textarea" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.title.trim() || pending} onClick={submit}>
          {pending ? "Saving…" : "Save incident"}
        </button>
      </Drawer>

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this incident">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p className="gate-copy" style={{ marginTop: 0 }}>
          This keeps the original entry visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.
        </p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.title}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Wrong category selected — should have been Fire, not Theft" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void incident"}
        </button>
      </Drawer>
    </div>
  );
}
