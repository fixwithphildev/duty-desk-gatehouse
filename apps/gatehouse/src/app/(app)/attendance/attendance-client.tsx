"use client";

import { useState, useTransition } from "react";
import { Plus, LogOut } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { statusTone } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { signInAction, signOutAttendanceAction } from "./actions";
import type { AttendanceRow } from "@/lib/data/attendance";

function fmtTime(iso: string | null): string {
  return !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { staffName: "", role: "Security Officer" };

export function AttendanceClient({ logs, canEdit }: { logs: AttendanceRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const signedIn = logs.filter((a) => a.status === "Signed In");
  const history = logs.filter((a) => a.status !== "Signed In");

  const submit = () => {
    if (!form.staffName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await signInAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const signOutRow = (id: string) => startTransition(async () => { await signOutAttendanceAction(id); });

  return (
    <div className="view">
      <div className="view-head">
        <h2>Staff Attendance</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Sign in</button> : null}
      </div>

      <div className="card">
        <div className="card-head"><span>On duty now ({signedIn.length})</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Staff</th><th>Role</th><th>Signed in</th><th /></tr></thead>
            <tbody>
              {signedIn.map((a) => (
                <tr key={a.id}>
                  <td className="cell-title">{a.staff_name}</td>
                  <td>{a.role}</td>
                  <td className="mono">{fmtTime(a.in_at)}</td>
                  <td>{canEdit ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => signOutRow(a.id)}><LogOut size={13} /> Sign out</button> : null}</td>
                </tr>
              ))}
              {signedIn.length === 0 ? <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>No one currently on duty.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>History</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Staff</th><th>Role</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td>{a.staff_name}</td>
                  <td>{a.role}</td>
                  <td className="mono">{fmtTime(a.in_at)}</td>
                  <td className="mono">{fmtTime(a.out_at)}</td>
                  <td><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Sign in">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Staff name"><input className="input" value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} /></Field>
        <Field label="Role"><input className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.staffName.trim() || pending} onClick={submit}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </Drawer>
    </div>
  );
}
