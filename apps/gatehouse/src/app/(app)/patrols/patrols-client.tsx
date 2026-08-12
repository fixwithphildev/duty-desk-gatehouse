"use client";

import { useState, useTransition } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { statusTone } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { startPatrolAction, completePatrolAction } from "./actions";
import type { PatrolRow } from "@/lib/data/patrols";

function fmtTime(iso: string | null): string {
  return !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PatrolsClient({ patrols, canEdit }: { patrols: PatrolRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState("");
  const [completing, setCompleting] = useState<PatrolRow | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startPatrol = () => {
    if (!route.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await startPatrolAction({ route });
        setRoute("");
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const completePatrol = () => {
    if (!completing) return;
    startTransition(async () => {
      await completePatrolAction(completing.id, notes);
      setCompleting(null);
      setNotes("");
    });
  };

  return (
    <div className="view">
      <div className="view-head">
        <h2>Patrols</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Start patrol</button> : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Officer</th><th>Route</th><th>Started</th><th>Status</th><th /></tr></thead>
          <tbody>
            {patrols.map((p) => (
              <tr key={p.id}>
                <td>{p.officer_name}</td>
                <td>{p.route}</td>
                <td className="mono">{fmtTime(p.started_at)}</td>
                <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                <td>
                  {canEdit && p.status === "In Progress" ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompleting(p)}>
                      <CheckCircle2 size={13} /> Complete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {patrols.length === 0 ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>No patrols logged yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Start a patrol">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Route"><input className="input" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="e.g. Lobby → Pool deck → Gym" /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!route.trim() || pending} onClick={startPatrol}>
          {pending ? "Starting…" : "Start patrol"}
        </button>
      </Drawer>

      <Drawer open={!!completing} onClose={() => setCompleting(null)} title="Complete patrol">
        <Field label="Findings / notes"><textarea className="textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. All clear" /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={pending} onClick={completePatrol}>
          {pending ? "Saving…" : "Mark completed"}
        </button>
      </Drawer>
    </div>
  );
}
