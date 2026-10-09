"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, ClipboardCopy, KeyRound, Plus, Search, ShieldCheck, Unlock, Users, Wrench } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { Badge, Kpi } from "@/components/suite";
import { MD_ROLE_LABELS, MD_UNITS, UNIT_COLOR, canManageAccount, creatableRolesFor, manageableRolesFor, type MDRole, type StaffAccount } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { createStaffAction, resetUsercodeAction, setAccountDisabledAction, setUnitAction, unlockAccountAction } from "./actions";
import type { LoginEventRow } from "@/lib/data/login-events";

const ROLE_ORDER: MDRole[] = ["super_admin", "maintenance_manager", "maintenance_supervisor", "head_of_operations", "maintenance_technician"];
const OFFICE: MDRole[] = ["super_admin", "maintenance_manager", "maintenance_supervisor", "head_of_operations"];
const inFilter = (a: StaffAccount, f: string) => f === "all" || (f === "office" ? OFFICE.includes(a.role) : a.unit === f);
// "Mr. Kola Adebayo" → "kola.adebayo"
const userOf = (n: string) => n.toLowerCase().replace(/^(mr|mrs|ms|dr|chief|engr)\.?\s+/, "").replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".");
const EMPTY = { username: "", displayName: "", role: "" as MDRole | "", unit: "" };

export function StaffClient({ accounts, loginEvents, lastSeen, actorRole, me }: { accounts: StaffAccount[]; loginEvents: (LoginEventRow & { when: string })[]; lastSeen: Record<string, string | null>; actorRole: MDRole; me: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [userTouched, setUserTouched] = useState(false);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ name: string; username: string; usercode: string; reset: boolean; unit: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const creatable = creatableRolesFor(actorRole);
  const canReset = ROLE_ORDER.filter((r) => manageableRolesFor(actorRole).includes(r)).map((r) => MD_ROLE_LABELS[r]);
  const isLocked = (a: StaffAccount) => !!a.locked_until && new Date(a.locked_until).getTime() > Date.now();
  const s = q.trim().toLowerCase();
  const list = accounts
    .filter((a) => inFilter(a, filter) && (!s || `${a.display_name} ${a.username} ${MD_ROLE_LABELS[a.role]} ${a.unit ?? ""}`.toLowerCase().includes(s)))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (a.unit ?? "").localeCompare(b.unit ?? "") || a.display_name.localeCompare(b.display_name));
  const active = accounts.filter((a) => !a.disabled);

  const submit = () => {
    const username = (userTouched ? form.username : form.username || userOf(form.displayName)).trim();
    if (!form.displayName.trim()) return setError("Give the person’s full name.");
    if (!username) return setError("Give them a username.");
    if (!form.role) return setError("Choose a role.");
    if (form.role === "maintenance_technician" && !form.unit) return setError("Choose the technician’s unit.");
    setError(null);
    startTransition(async () => {
      try {
        const r = await callAction(createStaffAction)({ username, displayName: form.displayName, role: form.role as MDRole, unit: form.unit });
        setOpen(false);
        setCopied(false);
        setReveal({ name: form.displayName.trim(), ...r, reset: false, unit: form.role === "maintenance_technician" ? form.unit : null });
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
    try { await navigator.clipboard.writeText(`Username: ${reveal.username}\nOne-time code: ${reveal.usercode}`); setCopied(true); } catch { setCopied(false); }
  };

  const filters: [string, string][] = [["all", "Everyone"], ["office", "Management"], ...MD_UNITS.map((u) => [u, u] as [string, string])];

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Staff accounts</h1><p>Who can sign in to Maintenance Desk. Only the Admin adds accounts. People sign in with a username and a one-time code, then choose their own usercode.</p></div>
        <div className="acts">{creatable.length ? <button type="button" className="btn btn-primary" onClick={() => { setForm(EMPTY); setUserTouched(false); setError(null); setOpen(true); }}><Plus size={15} /> Add staff account</button> : null}</div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Users} label="Active accounts" value={active.length} ctx={`${accounts.length} in total`} />
        <Kpi icon={Wrench} label="Technicians" value={active.filter((a) => a.role === "maintenance_technician").length} ctx={`across ${MD_UNITS.length} units`} />
        <Kpi icon={KeyRound} label="Waiting to choose a code" value={active.filter((a) => a.must_change_code).length} ctx="new or reset accounts" />
        <Kpi icon={Ban} label="Switched off" value={accounts.filter((a) => a.disabled).length} ctx="can’t sign in" />
      </div>

      <div className="pill-note t-info">
        <ShieldCheck size={16} />
        <span>{actorRole === "super_admin" ? "As Admin you add every account, and can reset a code or switch off any account." : canReset.length ? <>Only the Admin adds new accounts. You can reset a code, unlock or switch off: <b>{canReset.join(", ")}</b>.</> : "You can see every account. Only the Admin adds accounts."}</span>
      </div>
      {actError ? <div className="err-note" role="alert">{actError}</div> : null}

      <section className="card">
        <div className="card-h"><h3>Accounts</h3><span className="sp" /><span className="sub">{accounts.length} people</span></div>
        <div className="st-tools">
          <div className="seg" role="group" aria-label="Show" style={{ flexWrap: "wrap" }}>
            {filters.map(([f, l]) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l} <span className="ct">{accounts.filter((a) => inFilter(a, f)).length}</span></button>)}
          </div>
          <div className="input-wrap st-search"><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or username" style={{ height: 36 }} autoComplete="off" aria-label="Search accounts" /></div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Role</th><th>Unit</th><th>Username</th><th>Status</th><th>Last sign-in</th><th className="r" /></tr></thead>
            <tbody>
              {list.map((a) => {
                const self = a.id === me, can = !self && canManageAccount(actorRole, a.role), locked = isLocked(a);
                return (
                  <tr key={a.id} className={a.disabled ? "st-off" : ""}>
                    <td style={{ whiteSpace: "normal" }}><b style={{ fontWeight: 600 }}>{a.display_name}</b>{self ? <span className="muted"> (you)</span> : null}</td>
                    <td>{MD_ROLE_LABELS[a.role]}</td>
                    <td>
                      {a.role !== "maintenance_technician" ? <span className="muted">All units</span>
                        : can && !a.disabled ? (
                          <select className="input" style={{ height: 32, width: 190 }} value={a.unit ?? ""} disabled={pending} onChange={(e) => run(() => callAction(setUnitAction)(a.id, e.target.value))} aria-label={`Unit for ${a.display_name}`}>
                            {!a.unit ? <option value="">Choose a unit…</option> : null}
                            {MD_UNITS.map((u) => <option key={u}>{u}</option>)}
                          </select>
                        ) : a.unit ? <><i className="dot-u" style={{ background: UNIT_COLOR[a.unit] ?? "var(--neu)" }} />{a.unit}</> : <span style={{ color: "var(--warn-fg)" }}>No unit</span>}
                    </td>
                    <td className="mono">{a.username}</td>
                    <td>{a.disabled ? <Badge tone="neu" dot={false}>Switched off</Badge> : locked ? <Badge tone="bad">Locked</Badge> : a.must_change_code ? <Badge tone="warn">Must choose a code</Badge> : <Badge tone="ok" dot={false}>Active</Badge>}</td>
                    <td className="mono" style={{ color: "var(--text-3)" }}>{lastSeen[a.id] ?? "Never"}</td>
                    <td className="r">
                      {can ? (
                        <div className="hstack" style={{ justifyContent: "flex-end", gap: 4, flexWrap: "nowrap" }}>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(async () => { const r = await callAction(resetUsercodeAction)(a.id); setCopied(false); setReveal({ name: a.display_name, username: a.username, usercode: r.usercode, reset: true, unit: a.unit }); })}><KeyRound size={13} /> Reset code</button>
                          {locked ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => callAction(unlockAccountAction)(a.id))}><Unlock size={13} /> Unlock</button> : null}
                          {a.disabled
                            ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => callAction(setAccountDisabledAction)(a.id, false))}><CheckCircle2 size={13} /> Switch on</button>
                            : <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => callAction(setAccountDisabledAction)(a.id, true))}><Ban size={13} /> Switch off</button>}
                        </div>
                      ) : <span className="hint">{self ? "Your account" : "—"}</span>}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 ? <tr><td colSpan={7} className="empty">No accounts match.</td></tr> : null}
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
        sub="Technicians belong to one unit; everyone else covers all units"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Plus size={15} /> {pending ? "Creating…" : "Create account"}</button></>}
      >
        <Field label="Full name"><input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. Tunde Bakare" autoComplete="off" /></Field>
        <div className="hstack" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label htmlFor="st-role">Role</label>
            <select className="input" id="st-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MDRole })}>
              <option value="" disabled>Choose a role</option>
              {ROLE_ORDER.filter((r) => creatable.includes(r)).map((r) => <option key={r} value={r}>{MD_ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          {form.role === "maintenance_technician" ? (
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor="st-unit">Unit</label>
              <select className="input" id="st-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="">Choose a unit…</option>{MD_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="st-user">Username</label>
          <input className="input mono" id="st-user" value={userTouched ? form.username : form.username || userOf(form.displayName)} onChange={(e) => { setUserTouched(true); setForm({ ...form, username: e.target.value }); }} placeholder="tunde.bakare" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </div>
        <span className="hint">A one-time code is made for them. You’ll see it once, to pass on in person. They choose their own usercode when they first sign in.</span>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={!!reveal}
        onClose={() => setReveal(null)}
        over="Staff accounts"
        title={reveal?.reset ? "New one-time code" : "Account ready"}
        sub={reveal ? `${reveal.name}${reveal.unit ? ` · ${reveal.unit}` : ""}` : undefined}
        footer={<><button type="button" className="btn btn-secondary" onClick={copy}><ClipboardCopy size={15} /> {copied ? "Copied" : "Copy"}</button><button type="button" className="btn btn-primary" onClick={() => setReveal(null)}>Done</button></>}
      >
        {reveal ? (
          <div className="code-box">
            <span className="over">Give these to {reveal.name}</span>
            <dl className="kv"><dt>Username</dt><dd className="mono"><b>{reveal.username}</b></dd><dt>One-time code</dt><dd className="mono code-big">{reveal.usercode}</dd></dl>
            <span className="hint">{reveal.reset ? "The old usercode no longer works, and they’re signed out everywhere. " : ""}It works once: they choose their own usercode the first time they sign in. It’s shown only here; if it’s lost, reset it.</span>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
