"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, ClipboardCopy, KeyRound, Lock, Plus, Search, ShieldCheck, Unlock, Users } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { Badge, Kpi } from "@/components/suite";
import { DD_ROLE_LABELS, assignableRolesFor, canManageAccount, type DDRole, type StaffAccount } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createStaffAction, setAccountDisabledAction, resetUsercodeAction, unlockAccountAction } from "./actions";
import type { LoginEventRow } from "@/lib/data/login-events";

const ROLE_ORDER: DDRole[] = ["super_admin", "resident_manager", "general_manager", "supervisor", "resident_officer", "front_desk", "housekeeping", "engineering"];
const MANAGEMENT: DDRole[] = ["super_admin", "resident_manager", "general_manager", "supervisor"];
type Filter = "all" | "office" | "ro" | "other";
const FILTERS: [Filter, string][] = [["all", "Everyone"], ["office", "Management"], ["ro", "Resident Officers"], ["other", "Front desk & teams"]];
const inFilter = (a: StaffAccount, f: Filter) => f === "all" || (f === "office" ? MANAGEMENT.includes(a.role) : f === "ro" ? a.role === "resident_officer" : !MANAGEMENT.includes(a.role) && a.role !== "resident_officer");
// "Mr. Chioma Eze" → "chioma.eze"
const userOf = (n: string) => n.toLowerCase().replace(/^(mr|mrs|ms|dr|chief)\.?\s+/, "").replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".");

const EMPTY = { username: "", displayName: "", role: "" as DDRole | "" };

export function StaffClient({
  accounts,
  loginEvents,
  lastSeen,
  actorRole,
  me,
}: {
  accounts: StaffAccount[];
  loginEvents: (LoginEventRow & { when: string })[];
  lastSeen: Record<string, string | null>;
  actorRole: DDRole;
  me: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [userTouched, setUserTouched] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ name: string; username: string; usercode: string; reset: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const assignable = assignableRolesFor(actorRole);
  const isLocked = (a: StaffAccount) => !!a.locked_until && new Date(a.locked_until).getTime() > Date.now();
  const s = q.trim().toLowerCase();
  const list = accounts
    .filter((a) => inFilter(a, filter) && (!s || `${a.display_name} ${a.username} ${DD_ROLE_LABELS[a.role]}`.toLowerCase().includes(s)))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.display_name.localeCompare(b.display_name));
  const active = accounts.filter((a) => !a.disabled);

  const submit = () => {
    const username = (userTouched ? form.username : form.username || userOf(form.displayName)).trim();
    if (!form.displayName.trim()) return setError("Give the person’s full name.");
    if (!username) return setError("Give them a username.");
    if (!form.role) return setError("Choose a role.");
    setError(null);
    startTransition(async () => {
      try {
        const result = await createStaffAction({ username, displayName: form.displayName, role: form.role as DDRole });
        setOpen(false);
        setCopied(false);
        setReveal({ name: form.displayName.trim(), ...result, reset: false });
        setForm(EMPTY);
        setUserTouched(false);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const run = (fn: () => Promise<void>) => {
    setActError(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setActError(errorMessage(e)); }
    });
  };

  const copy = async () => {
    if (!reveal) return;
    try { await navigator.clipboard.writeText(`Username: ${reveal.username}\nUsercode: ${reveal.usercode}`); setCopied(true); } catch { setCopied(false); }
  };

  const mine = ROLE_ORDER.filter((r) => assignable.includes(r)).map((r) => DD_ROLE_LABELS[r]);

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Staff accounts</h1><p>Who can sign in to Duty Desk. Only the Resident Manager, Supervisor and Admin can see this page. People sign in with a username and a usercode.</p></div>
        <div className="acts">{assignable.length ? <button type="button" className="btn btn-primary" onClick={() => { setForm(EMPTY); setUserTouched(false); setError(null); setOpen(true); }}><Plus size={15} /> Add staff account</button> : null}</div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Users} label="Active accounts" value={active.length} ctx={`${accounts.length} in total`} />
        <Kpi icon={ShieldCheck} label="Resident Officers" value={active.filter((a) => a.role === "resident_officer").length} ctx="on every shift" />
        <Kpi icon={Lock} label="Locked out" value={accounts.filter(isLocked).length} ctx="too many wrong usercodes" tile={accounts.some(isLocked) ? "warn" : ""} />
        <Kpi icon={Ban} label="Switched off" value={accounts.filter((a) => a.disabled).length} ctx="can’t sign in" />
      </div>

      <div className="pill-note t-info">
        <ShieldCheck size={16} />
        <span>{mine.length ? <>You can add, reset and switch off: <b>{mine.join(", ")}</b>.{actorRole !== "super_admin" ? " For other accounts, ask Admin (IT)." : ""}</> : "You can see every account. Only the Resident Manager or Admin can add people, reset a usercode or switch an account off."}</span>
      </div>

      {actError ? <div className="err-note" role="alert">{actError}</div> : null}

      <section className="card">
        <div className="card-h"><h3>Accounts</h3><span className="sp" /><span className="sub">{accounts.length} people</span></div>
        <div className="st-tools">
          <div className="seg" role="group" aria-label="Show">
            {FILTERS.map(([f, l]) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l} <span className="ct">{accounts.filter((a) => inFilter(a, f)).length}</span></button>)}
          </div>
          <div className="input-wrap st-search"><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or username" style={{ height: 36 }} autoComplete="off" aria-label="Search accounts" /></div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Status</th><th>Last sign-in</th><th className="r" /></tr></thead>
            <tbody>
              {list.map((a) => {
                const self = a.id === me, can = !self && canManageAccount(actorRole, a.role), locked = isLocked(a);
                return (
                  <tr key={a.id} className={a.disabled ? "st-off" : ""}>
                    <td style={{ whiteSpace: "normal" }}><b style={{ fontWeight: 600 }}>{a.display_name}</b>{self ? <span className="muted"> (you)</span> : null}</td>
                    <td>{DD_ROLE_LABELS[a.role]}</td>
                    <td className="mono">{a.username}</td>
                    <td>{a.disabled ? <Badge tone="neu" dot={false}>Switched off</Badge> : locked ? <Badge tone="warn">Locked</Badge> : <Badge tone="ok" dot={false}>Active</Badge>}</td>
                    <td className="mono" style={{ color: "var(--text-3)" }}>{lastSeen[a.id] ?? "Never"}</td>
                    <td className="r">
                      {can ? (
                        <div className="hstack" style={{ justifyContent: "flex-end", gap: 4, flexWrap: "nowrap" }}>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(async () => { const r = await resetUsercodeAction(a.id); setCopied(false); setReveal({ name: a.display_name, username: a.username, usercode: r.usercode, reset: true }); })}><KeyRound size={13} /> Reset code</button>
                          {locked ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => unlockAccountAction(a.id))}><Unlock size={13} /> Unlock</button> : null}
                          {a.disabled
                            ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setAccountDisabledAction(a.id, false))}><CheckCircle2 size={13} /> Switch on</button>
                            : <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => setAccountDisabledAction(a.id, true))}><Ban size={13} /> Switch off</button>}
                        </div>
                      ) : <span className="hint">{self ? "Your account" : "—"}</span>}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? <tr><td colSpan={6} className="empty">No accounts match.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h3>Recent sign-ins</h3><span className="sp" /><span className="sub">last {loginEvents.length}</span></div>
        <ul className="list">
          {loginEvents.map((e) => (
            <li key={e.id} className="row">
              <span className={`stripe ${e.success ? "s-ok" : "s-bad"}`} />
              <div className="m"><b className="mono" style={{ fontWeight: 500 }}>{e.username_attempted}</b><span>{e.success ? "Signed in" : `Failed: ${e.reason ?? "unknown reason"}`}</span></div>
              <span className="age">{e.when}</span>
            </li>
          ))}
          {loginEvents.length === 0 ? <li className="empty">No sign-ins yet.</li> : null}
        </ul>
      </section>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Staff accounts"
        title="Add staff account"
        sub={mine.length ? `You can add: ${mine.join(", ")}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Plus size={15} /> {pending ? "Creating…" : "Create account"}</button></>}
      >
        <Field label="Full name"><input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. Chioma Eze" autoComplete="off" /></Field>
        <div className="hstack" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="st-user">Username</label>
            <input className="input mono" id="st-user" value={userTouched ? form.username : form.username || userOf(form.displayName)} onChange={(e) => { setUserTouched(true); setForm({ ...form, username: e.target.value }); }} placeholder="chioma.eze" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="st-role">Role</label>
            <select className="input" id="st-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as DDRole })}>
              <option value="" disabled>Choose a role</option>
              {ROLE_ORDER.filter((r) => assignable.includes(r)).map((r) => <option key={r} value={r}>{DD_ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
        <span className="hint">A usercode is made for them. You’ll see it once, to pass on in person.</span>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={!!reveal}
        onClose={() => setReveal(null)}
        over="Staff accounts"
        title={reveal?.reset ? "New usercode" : "Account ready"}
        sub={reveal?.name}
        footer={<><button type="button" className="btn btn-secondary" onClick={copy}><ClipboardCopy size={15} /> {copied ? "Copied" : "Copy"}</button><button type="button" className="btn btn-primary" onClick={() => setReveal(null)}>Done</button></>}
      >
        {reveal ? (
          <div className="code-box">
            <span className="over">Give these to {reveal.name}</span>
            <dl className="kv"><dt>Username</dt><dd className="mono"><b>{reveal.username}</b></dd><dt>Usercode</dt><dd className="mono code-big">{reveal.usercode}</dd></dl>
            <span className="hint">{reveal.reset ? "The old usercode no longer works. " : ""}It’s shown only once. If it’s lost, reset it here. They can change it from My account after signing in.</span>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
