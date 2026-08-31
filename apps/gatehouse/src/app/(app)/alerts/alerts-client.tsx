"use client";

import { useState, useTransition } from "react";
import { Plus, AlertOctagon, CheckCircle2, Ban } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { GH_SEVERITIES, severityTone } from "@/lib/types";
import { GH_ALERT_TYPES } from "@/lib/constants";
import type { AlertRow } from "@/lib/data/alerts";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { raiseAlertAction, acknowledgeAlertAction, voidAlertAction } from "./actions";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { type: GH_ALERT_TYPES[0], severity: "Medium", message: "", location: "" };

export function AlertsClient({ alerts, canEdit, canVoid }: { alerts: AlertRow[]; canEdit: boolean; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<AlertRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const submit = () => {
    if (!form.message.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await raiseAlertAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const acknowledge = (id: string) => startTransition(async () => { await acknowledgeAlertAction(id); });

  const submitVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidAlertAction(voidTarget.id, voidReason);
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
        <h2>Alerts</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Raise alert</button> : null}
      </div>

      <div className="alert-list">
        {alerts.map((a) => (
          <div key={a.id} className={`alert-card tone-${severityTone(a.severity)}`} style={a.void ? { opacity: 0.6 } : undefined}>
            <AlertOctagon size={18} />
            <div className="alert-main">
              <div className="alert-top">
                <span className="alert-type">{a.type}</span>
                <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
              </div>
              <div className="alert-msg">{a.message}</div>
              <div className="alert-meta mono">{a.location ?? "—"} · raised by {a.raised_by_name} · {fmtTime(a.created_at)}</div>
              {a.void ? (
                <div className="alert-meta" style={{ color: "var(--red)", marginTop: 4 }}>Voided by {a.voided_by_name} — {a.void_reason}</div>
              ) : null}
            </div>
            {a.void ? (
              <Badge tone="neutral">Voided</Badge>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                {a.status !== "Acknowledged" ? (
                  canEdit ? (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => acknowledge(a.id)}>
                      <CheckCircle2 size={13} /> Acknowledge
                    </button>
                  ) : (
                    <Badge tone="amber">Unacknowledged</Badge>
                  )
                ) : (
                  <Badge tone="green">Acknowledged</Badge>
                )}
                {canVoid ? (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { setVoidTarget(a); setVoidReason(""); setVoidError(null); }}>
                    <Ban size={13} /> Void
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}
        {alerts.length === 0 ? <div className="empty-state"><AlertOctagon size={26} strokeWidth={1.5} /><div className="empty-title">No alerts raised</div></div> : null}
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Raise an alert">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Type">
          <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {GH_ALERT_TYPES.map((t) => <option key={t}>{t}</option>)}
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
        <Field label="Message"><textarea className="textarea" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.message.trim() || pending} onClick={submit}>
          {pending ? "Raising…" : "Raise alert"}
        </button>
      </Drawer>

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this alert">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p className="gate-copy" style={{ marginTop: 0 }}>This keeps the original entry visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.message}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Raised by mistake" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void alert"}
        </button>
      </Drawer>
    </div>
  );
}
