"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { GH_SEVERITIES, severityTone } from "@/lib/types";
import { GH_INCIDENT_CATEGORIES, GH_INCIDENT_STATUSES } from "@/lib/constants";
import type { IncidentRow } from "@/lib/data/incidents";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createIncidentAction, updateIncidentStatusAction } from "./actions";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { title: "", category: GH_INCIDENT_CATEGORIES[0], severity: "Low", location: "", description: "" };

export function IncidentsClient({ incidents, canEdit }: { incidents: IncidentRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
              <tr key={i.id}>
                <td className="mono">{fmtTime(i.created_at)}</td>
                <td className="cell-title">{i.title}</td>
                <td>{i.category}</td>
                <td><Badge tone={severityTone(i.severity)}>{i.severity}</Badge></td>
                <td>{i.location || "—"}</td>
                <td>
                  {canEdit ? (
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
    </div>
  );
}
