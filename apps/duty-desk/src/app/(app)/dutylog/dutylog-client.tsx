"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { addDutyLogEntryAction, voidDutyLogEntryAction } from "./actions";
import type { DutyLogRow } from "@/lib/data/dutylog";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DutyLogClient({ entries, canEdit }: { entries: DutyLogRow[]; canEdit: boolean }) {
  const [notes, setNotes] = useState("");
  const [handover, setHandover] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<DutyLogRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  const submit = () => {
    if (!notes.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addDutyLogEntryAction({ notes, handover });
        setNotes("");
        setHandover(false);
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
        await voidDutyLogEntryAction(voidTarget.id, voidReason);
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
      <div className="view-head"><h2>Duty Log</h2></div>

      {canEdit ? (
        <div className="card">
          {error ? <div className="login-error">{error}</div> : null}
          <Field label="Log entry">
            <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened this shift" />
          </Field>
          <label className="checkbox-row">
            <input type="checkbox" checked={handover} onChange={(e) => setHandover(e.target.checked)} />
            <span>Mark as shift handover note</span>
          </label>
          <button type="button" className="btn btn-primary" disabled={!notes.trim() || pending} onClick={submit}>
            {pending ? "Adding…" : "Add entry"}
          </button>
        </div>
      ) : null}

      <ul className="feed feed-card">
        {entries.map((d) => (
          <li key={d.id} className="feed-row feed-row-block" style={d.void ? { opacity: 0.6 } : undefined}>
            <span className={`feed-dot ${d.handover ? "tone-gold" : ""}`} />
            <div className="feed-main">
              <div className="feed-label">{d.notes}</div>
              <div className="feed-meta mono">
                {d.officer_name} · {fmtTime(d.created_at)}
                {d.handover ? (d.void ? " · Handover note · Voided" : d.acknowledged_at ? " · Handover note · Handled" : " · Handover note · Outstanding") : ""}
              </div>
              {d.void ? (
                <div className="feed-meta" style={{ color: "var(--red)" }}>Voided by {d.voided_by_name} — {d.void_reason}</div>
              ) : canEdit ? (
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { setVoidTarget(d); setVoidReason(""); setVoidError(null); }}>
                  <Ban size={12} /> Void
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {entries.length === 0 ? <li style={{ padding: 16, opacity: 0.75, fontSize: 13 }}>No duty log entries yet.</li> : null}
      </ul>

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this log entry">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 0 }}>This keeps the original entry visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.notes}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Logged under the wrong shift" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void entry"}
        </button>
      </Drawer>
    </div>
  );
}
