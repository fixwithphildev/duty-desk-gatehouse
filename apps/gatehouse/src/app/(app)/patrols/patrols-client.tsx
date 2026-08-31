"use client";

import { useState, useTransition } from "react";
import { Plus, CheckCircle2, Ban } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { statusTone } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { startPatrolAction, completePatrolAction, voidPatrolAction } from "./actions";
import type { PatrolRow } from "@/lib/data/patrols";

function fmtTime(iso: string | null): string {
  return !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PatrolsClient({ patrols, canEdit, canVoid }: { patrols: PatrolRow[]; canEdit: boolean; canVoid: boolean }) {
  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState("");
  const [completing, setCompleting] = useState<PatrolRow | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<PatrolRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

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

  const submitVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidPatrolAction(voidTarget.id, voidReason);
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
        <h2>Patrols</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Start patrol</button> : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Officer</th><th>Route</th><th>Started</th><th>Ended</th><th>Findings</th><th>Status</th><th /></tr></thead>
          <tbody>
            {patrols.map((p) => (
              <tr key={p.id} style={p.void ? { opacity: 0.6 } : undefined}>
                <td data-label="Officer">{p.officer_name}</td>
                <td data-label="Route">
                  {p.route}
                  {p.void ? <div className="cell-sub" style={{ color: "var(--red)" }}>Voided by {p.voided_by_name} — {p.void_reason}</div> : null}
                </td>
                <td className="mono" data-label="Started">{fmtTime(p.started_at)}</td>
                <td className="mono" data-label="Ended">{fmtTime(p.ended_at)}</td>
                <td className="cell-sub" data-label="Findings">{p.notes || "—"}</td>
                <td data-label="Status">{p.void ? <Badge tone="neutral">Voided</Badge> : <Badge tone={statusTone(p.status)}>{p.status}</Badge>}</td>
                <td>
                  {!p.void ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      {canEdit && p.status === "In Progress" ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCompleting(p)}>
                          <CheckCircle2 size={13} /> Complete
                        </button>
                      ) : null}
                      {canVoid ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVoidTarget(p); setVoidReason(""); setVoidError(null); }}>
                          <Ban size={13} /> Void
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {patrols.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>No patrols logged yet.</td></tr> : null}
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

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this patrol">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p className="gate-copy" style={{ marginTop: 0 }}>This keeps the original entry visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.route}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Logged by mistake, no patrol actually happened" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void patrol"}
        </button>
      </Drawer>
    </div>
  );
}
