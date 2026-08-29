"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/ui";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { addDutyLogEntryAction } from "./actions";
import type { DutyLogRow } from "@/lib/data/dutylog";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function DutyLogClient({ entries, canEdit }: { entries: DutyLogRow[]; canEdit: boolean }) {
  const [notes, setNotes] = useState("");
  const [handover, setHandover] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
          <li key={d.id} className="feed-row feed-row-block">
            <span className={`feed-dot ${d.handover ? "tone-gold" : ""}`} />
            <div className="feed-main">
              <div className="feed-label">{d.notes}</div>
              <div className="feed-meta mono">
                {d.officer_name} · {fmtTime(d.created_at)}
                {d.handover ? (d.acknowledged_at ? " · Handover note · Handled" : " · Handover note · Outstanding") : ""}
              </div>
            </div>
          </li>
        ))}
        {entries.length === 0 ? <li style={{ padding: 16, opacity: 0.75, fontSize: 13 }}>No duty log entries yet.</li> : null}
      </ul>
    </div>
  );
}
