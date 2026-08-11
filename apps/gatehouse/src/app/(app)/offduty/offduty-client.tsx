"use client";

import { useState, useTransition } from "react";
import { Plus, LogOut } from "lucide-react";
import { Drawer, Field } from "@/components/ui";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { logOffDutyVisitAction, signOutOffDutyAction } from "./actions";
import type { OffDutyRow } from "@/lib/data/attendance";

function fmtTime(iso: string | null): string {
  return !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { staffName: "", department: "", reason: "" };

export function OffDutyClient({ logs, canEdit }: { logs: OffDutyRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSite = logs.filter((o) => o.status === "Signed In");
  const history = logs.filter((o) => o.status === "Signed Out");

  const submit = () => {
    if (!form.staffName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await logOffDutyVisitAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const signOutRow = (id: string) => startTransition(async () => { await signOutOffDutyAction(id); });

  return (
    <div className="view">
      <div className="view-head">
        <h2>Off-Duty Staff Attendance</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Log visit</button> : null}
      </div>
      <p className="gate-copy" style={{ marginTop: -8 }}>For staff visiting the property while off shift — kept separate from on-duty attendance.</p>

      <div className="card">
        <div className="card-head"><span>Currently on site ({onSite.length})</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Staff</th><th>Department</th><th>Reason</th><th>In</th><th /></tr></thead>
            <tbody>
              {onSite.map((o) => (
                <tr key={o.id}>
                  <td className="cell-title">{o.staff_name}</td>
                  <td>{o.department || "—"}</td>
                  <td className="cell-sub">{o.reason || "—"}</td>
                  <td className="mono">{fmtTime(o.in_at)}</td>
                  <td>{canEdit ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => signOutRow(o.id)}><LogOut size={13} /> Sign out</button> : null}</td>
                </tr>
              ))}
              {onSite.length === 0 ? <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>No off-duty visitors currently on site.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>History</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Staff</th><th>Department</th><th>In</th><th>Out</th></tr></thead>
            <tbody>
              {history.map((o) => (
                <tr key={o.id}>
                  <td>{o.staff_name}</td>
                  <td>{o.department || "—"}</td>
                  <td className="mono">{fmtTime(o.in_at)}</td>
                  <td className="mono">{fmtTime(o.out_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Log an off-duty visit">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Staff name"><input className="input" value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} /></Field>
        <Field label="Department"><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Resident Officer" /></Field>
        <Field label="Reason for visit"><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.staffName.trim() || pending} onClick={submit}>
          {pending ? "Logging…" : "Log visit"}
        </button>
      </Drawer>
    </div>
  );
}
