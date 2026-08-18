"use client";

import { useState, useTransition } from "react";
import { Plus, KeyRound, Ban, CheckCircle2, Unlock } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { GH_ROLE_LABELS, assignableRolesFor, canManageAccount, type GHRole, type StaffAccount } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createStaffAction, setAccountDisabledAction, resetUsercodeAction, unlockAccountAction } from "./actions";
import type { LoginEventRow } from "@/lib/data/login-events";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { username: "", displayName: "", role: "" as GHRole | "" };

export function StaffClient({
  accounts,
  loginEvents,
  actorRole,
}: {
  accounts: StaffAccount[];
  loginEvents: LoginEventRow[];
  actorRole: GHRole;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ username: string; usercode: string } | null>(null);

  const assignable = assignableRolesFor(actorRole);

  const submit = () => {
    if (!form.username.trim() || !form.displayName.trim() || !form.role) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createStaffAction({ username: form.username, displayName: form.displayName, role: form.role as GHRole });
        setForm(EMPTY);
        setOpen(false);
        setReveal(result);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const toggleDisabled = (id: string, disabled: boolean) =>
    startTransition(async () => { await setAccountDisabledAction(id, disabled); });

  const resetCode = (id: string, username: string) =>
    startTransition(async () => {
      const result = await resetUsercodeAction(id);
      setReveal({ username, usercode: result.usercode });
    });

  const unlock = (id: string) => startTransition(async () => { await unlockAccountAction(id); });

  return (
    <div className="view">
      <div className="view-head">
        <h2>Staff Accounts</h2>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <Plus size={15} /> New account
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>
            {accounts.map((a) => {
              const locked = a.locked_until && new Date(a.locked_until).getTime() > Date.now();
              const manageable = canManageAccount(actorRole, a.role);
              return (
                <tr key={a.id}>
                  <td className="cell-title mono" data-label="Username">{a.username}</td>
                  <td data-label="Name">{a.display_name}</td>
                  <td data-label="Role">{GH_ROLE_LABELS[a.role]}</td>
                  <td data-label="Status">
                    {a.disabled ? <Badge tone="red">Disabled</Badge> : locked ? <Badge tone="gold">Locked</Badge> : <Badge tone="teal">Active</Badge>}
                  </td>
                  <td>
                    {manageable ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => resetCode(a.id, a.username)}>
                          <KeyRound size={13} /> Reset code
                        </button>
                        {locked ? (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => unlock(a.id)}>
                            <Unlock size={13} /> Unlock
                          </button>
                        ) : null}
                        {a.disabled ? (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => toggleDisabled(a.id, false)}>
                            <CheckCircle2 size={13} /> Enable
                          </button>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => toggleDisabled(a.id, true)}>
                            <Ban size={13} /> Disable
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="cell-sub">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><span>Recent login activity</span></div>
        <ul className="feed">
          {loginEvents.map((e) => (
            <li key={e.id} className="feed-row feed-row-block">
              <span className={`feed-dot ${e.success ? "tone-teal" : "tone-red"}`} />
              <div className="feed-main">
                <div className="feed-label">{e.username_attempted} — {e.success ? "signed in" : `failed (${e.reason ?? "unknown"})`}</div>
                <div className="feed-meta mono">{fmtTime(e.created_at)}</div>
              </div>
            </li>
          ))}
          {loginEvents.length === 0 ? <li style={{ padding: 12, opacity: 0.6, fontSize: 13 }}>No login activity yet.</li> : null}
        </ul>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Create a staff account">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Username">
          <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. a.bello" />
        </Field>
        <Field label="Display name">
          <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. A. Bello" />
        </Field>
        <Field label="Role">
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as GHRole })}>
            <option value="" disabled>Select a role</option>
            {assignable.map((r) => <option key={r} value={r}>{GH_ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
        <button
          type="button"
          className="btn btn-primary drawer-submit"
          disabled={!form.username.trim() || !form.displayName.trim() || !form.role || pending}
          onClick={submit}
        >
          {pending ? "Creating…" : "Create account & generate usercode"}
        </button>
      </Drawer>

      <Drawer open={!!reveal} onClose={() => setReveal(null)} title="Usercode — shown once">
        {reveal ? (
          <>
            <p className="gate-copy" style={{ marginTop: 0 }}>
              Give this usercode to <strong>{reveal.username}</strong> directly. It won&apos;t be shown again — reset it from this page if it&apos;s lost.
            </p>
            <div className="usercode-reveal">{reveal.usercode}</div>
            <button type="button" className="btn btn-primary drawer-submit" onClick={() => setReveal(null)}>Done</button>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
