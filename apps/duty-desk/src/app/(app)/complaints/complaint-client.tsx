"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, Filter, MessageSquare, Plus, Search, UserRound, Wrench } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { Badge, priTone, stTone } from "@/components/suite";
import { DD_COMPLAINT_CATEGORIES, DD_COMPLAINT_TEAMS, DD_PRIORITIES } from "@/lib/checklist-data";
import { aptWhere, findApartment, suggestApartments } from "@/lib/apartments";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { assignComplaintAction, createComplaintAction, updateComplaintStatusAction, voidComplaintAction } from "./actions";
import type { ComplaintRow } from "@/lib/data/complaints";

export interface ComplaintView extends ComplaintRow {
  apartment: string;
  loggedWhen: string;
  age: string;
  progressWhen: string | null;
  resolvedWhen: string | null;
  voidedWhen: string | null;
}

type Priority = "Low" | "Medium" | "High";
type Tab = "open" | "resolved" | "all";
const STAGES = ["Open", "In Progress", "Resolved"] as const;
const EMPTY = { guestName: "", room: "", category: "Service", priority: "Medium" as Priority, description: "", assignedTo: "Resident Officers", repair: false };

export function ComplaintsClient({ complaints, initialId, initialApartment, canEdit, canVoid, me }: { complaints: ComplaintView[]; initialId: string | null; initialApartment: string; canEdit: boolean; canVoid: boolean; me: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [q, setQ] = useState(initialApartment);
  const [pri, setPri] = useState<"all" | Priority>("all");
  const [selId, setSelId] = useState<string | null>(initialId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [aptFocus, setAptFocus] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const live = complaints;
  const inTab = (c: ComplaintView, t: Tab) => t === "all" || (t === "open" ? c.status !== "Resolved" && !c.void : c.status === "Resolved" || c.void);
  const s = q.trim().toLowerCase();
  const list = live.filter((c) => inTab(c, tab) && (pri === "all" || c.priority === pri) && (!s || `${c.guest_name ?? ""} ${c.apartment} ${c.description} ${c.category}`.toLowerCase().includes(s)));
  const sel = live.find((c) => c.id === selId) ?? list[0] ?? null;

  useEffect(() => { setNote(sel?.resolution_note ?? ""); setActError(null); }, [sel?.id, sel?.resolution_note]);
  useEffect(() => {
    if (initialId) { const c = live.find((x) => x.id === initialId); if (c && !inTab(c, "open")) setTab("all"); }
  }, [initialId]);

  const apt = findApartment(form.room);
  const aptSugg = form.room.trim() && !apt ? suggestApartments(form.room) : [];

  const submit = () => {
    if (!apt) return setError("Choose the apartment from the list.");
    if (!form.description.trim()) return setError("Say what happened.");
    setError(null);
    startTransition(async () => {
      try {
        const r = await callAction(createComplaintAction)({ ...form, room: apt.name });
        setForm(EMPTY);
        setOpen(false);
        setTab("open");
        setQ("");
        setSelId(r.id);
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

  const tabN = (t: Tab) => live.filter((c) => inTab(c, t)).length;
  const si = sel ? STAGES.indexOf(sel.status) : 0;

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Complaints &amp; requests</h1><p>Guest and resident issues, routed to a team and tracked to resolution.</p></div>
        <div className="acts">{canEdit ? <button type="button" className="btn btn-primary" onClick={() => { setForm({ ...EMPTY, room: initialApartment }); setError(null); setOpen(true); }}><Plus size={15} /> Log complaint</button> : null}</div>
      </div>

      <div className="g g-main g-split-a">
        <section className="card">
          <div className="tabs" role="tablist" style={{ paddingTop: 4 }}>
            {([["open", "Open"], ["resolved", "Resolved"], ["all", "All"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{tabN(k)}</span></button>
            ))}
          </div>
          <div className="hstack" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <div className="input-wrap" style={{ flex: 1, minWidth: 160 }}><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guest, apartment or text" style={{ height: 36 }} autoComplete="off" aria-label="Search complaints" /></div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPri((p) => (p === "all" ? "High" : p === "High" ? "Medium" : p === "Medium" ? "Low" : "all"))} aria-label={`Filter by priority, now ${pri === "all" ? "all" : pri}`}>
              <Filter size={14} /> {pri === "all" ? "Priority" : `${pri} only`}
            </button>
          </div>
          <ul className="list">
            {list.map((c) => (
              <li key={c.id} className="row click" onClick={() => setSelId(c.id)} style={sel?.id === c.id ? { background: "var(--acc-bg)" } : undefined}>
                <span className={`stripe s-${c.void ? "neu" : priTone(c.priority)}`} />
                <div className="m"><b>{c.guest_name || "Guest not given"} · {c.apartment || "—"}</b><span>{c.description.length > 64 ? c.description.slice(0, 64) + "…" : c.description}</span></div>
                <div className="vstack" style={{ alignItems: "flex-end", gap: 4 }}>
                  {c.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={stTone(c.status)}>{c.status === "In Progress" ? "In progress" : c.status}</Badge>}
                  <span className="age">{c.age}</span>
                </div>
              </li>
            ))}
            {list.length === 0 ? <li className="empty" style={{ padding: "24px 16px" }}>{q.trim() || pri !== "all" ? <>No complaints match{q.trim() ? ` “${q.trim()}”` : ""}{pri !== "all" ? ` at ${pri.toLowerCase()} priority` : ""}.</> : complaints.length === 0 ? "No complaints yet." : tab === "open" ? "No open complaints." : tab === "resolved" ? "Nothing resolved yet." : "No complaints yet."}</li> : null}
          </ul>
        </section>

        {sel ? (
          <section className="card">
            <div className="card-h" style={{ alignItems: "flex-start" }}>
              <div className="vstack" style={{ gap: 4, flex: 1 }}>
                <span className="mono muted" style={{ fontSize: 12 }}>Logged {sel.loggedWhen}</span>
                <h3 style={{ fontSize: 18 }}>{sel.category} · {sel.apartment || "—"}</h3>
                <div className="hstack">
                  <Badge tone={priTone(sel.priority)}>{sel.priority} priority</Badge>
                  {sel.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={stTone(sel.status)}>{sel.status === "In Progress" ? "In progress" : sel.status}</Badge>}
                </div>
              </div>
            </div>
            <div className="card-b vstack" style={{ gap: 20 }}>
              <div className="steps">{STAGES.map((st, i) => <div key={st} className={i <= si ? "done" : ""}>{st === "In Progress" ? "In progress" : st}</div>)}</div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{sel.description}</p>
              <dl className="kv">
                <dt>Guest / resident</dt><dd>{sel.guest_name || "Not given"}</dd>
                <dt>Apartment</dt><dd>{findApartment(sel.apartment) ? <Link className="link" href={`/board?apt=${encodeURIComponent(sel.apartment)}`}>{sel.apartment}</Link> : sel.apartment || "—"}</dd>
                <dt>Logged by</dt><dd>{sel.logged_by_name ?? "—"}</dd>
                <dt>Assigned to</dt>
                <dd>
                  {canEdit && !sel.void && sel.status !== "Resolved" ? (
                    <select className="input" style={{ height: 34, maxWidth: 260 }} value={sel.assigned_to} disabled={pending} onChange={(e) => run(() => callAction(assignComplaintAction)(sel.id, e.target.value))} aria-label="Assign to a team">
                      {DD_COMPLAINT_TEAMS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  ) : sel.assigned_to}
                </dd>
                {sel.ticket_id ? <><dt>Repair ticket</dt><dd><Link className="link" href={`/maintenance?id=${sel.ticket_id}`}><Wrench size={13} /> Open the ticket</Link></dd></> : null}
                {sel.void ? <><dt>Voided</dt><dd>{sel.voided_by_name} · {sel.void_reason}</dd></> : null}
              </dl>
              {!sel.void ? (
                <div className="field">
                  <label htmlFor="cmp-note">Resolution note</label>
                  <textarea className="input" id="cmp-note" rows={3} value={note} disabled={!canEdit || sel.status === "Resolved"} onChange={(e) => setNote(e.target.value)} placeholder="What was done, and who confirmed it with the guest" />
                </div>
              ) : null}
              {actError ? <div className="err-note" role="alert">{actError}</div> : null}
              {!sel.void ? (
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  {canVoid ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVoidReason(""); setVoidOpen(true); }}><Ban size={13} /> Void</button> : <span className="hint">Only a Supervisor or a manager can void a complaint.</span>}
                  {canEdit ? (
                    <div className="hstack">
                      {si < 1 ? <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => callAction(updateComplaintStatusAction)(sel.id, "In Progress"))}>Mark in progress</button> : null}
                      {si < 2 ? <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => callAction(updateComplaintStatusAction)(sel.id, "Resolved", note))}><Check size={14} /> Resolve</button>
                        : <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => callAction(updateComplaintStatusAction)(sel.id, "Open"))}>Reopen</button>}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <hr className="sep" />
              <div className="vstack">
                <span className="over">Activity</span>
                <ul className="tl" style={{ padding: 0 }}>
                  <li><span className="tm">{sel.loggedWhen.replace(/^Today /, "")}</span><span className="dt"><MessageSquare size={11} /></span><span className="tx"><b>{sel.logged_by_name ?? "Someone"}</b> logged the complaint{sel.ticket_id ? " and sent a repair ticket to Maintenance" : ""}</span></li>
                  {sel.progressWhen ? <li><span className="tm">{sel.progressWhen.replace(/^Today /, "")}</span><span className="dt"><UserRound size={11} /></span><span className="tx">Moved to In progress</span></li> : null}
                  {sel.resolvedWhen ? <li><span className="tm">{sel.resolvedWhen.replace(/^Today /, "")}</span><span className="dt"><Check size={11} /></span><span className="tx">{sel.resolved_by_name ? <><b>{sel.resolved_by_name}</b> resolved it</> : "Marked resolved"}{sel.resolution_note ? `: “${sel.resolution_note}”` : ""}</span></li> : null}
                  {sel.voidedWhen ? <li><span className="tm">{sel.voidedWhen.replace(/^Today /, "")}</span><span className="dt"><Ban size={11} /></span><span className="tx"><b>{sel.voided_by_name}</b> voided it: {sel.void_reason}</span></li> : null}
                </ul>
              </div>
            </div>
          </section>
        ) : (
          <section className="card empty">{complaints.length === 0 ? "No complaints yet." : tab === "open" ? "Nothing open right now. Past complaints are under Resolved and All." : "Nothing to show here."}</section>
        )}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Complaints"
        title="Log a complaint"
        sub={`Logged by ${me}`}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Plus size={15} /> {pending ? "Saving…" : "Log complaint"}</button></>}
      >
        <div className="hstack" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
          <div className="field gsearch" style={{ flex: 1 }}>
            <label htmlFor="lc-apt">Apartment</label>
            <input className="input" id="lc-apt" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} onFocus={() => setAptFocus(true)} onBlur={() => setTimeout(() => setAptFocus(false), 150)} placeholder="Start typing, e.g. Lisbon" autoComplete="off" />
            {aptFocus && aptSugg.length ? (
              <div className="sugg" role="listbox">{aptSugg.map((a) => <button key={a.name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setForm({ ...form, room: a.name }); setAptFocus(false); }}><b>{a.name}</b><span>{aptWhere(a)}</span></button>)}</div>
            ) : null}
          </div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="lc-guest">Guest or resident</label><input className="input" id="lc-guest" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} placeholder="Name" /></div>
        </div>
        <div className="field"><span className="flabel">Category</span><div className="seg" role="group" aria-label="Category">{DD_COMPLAINT_CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={form.category === c} onClick={() => setForm({ ...form, category: c })}>{c}</button>)}</div></div>
        <div className="field"><span className="flabel">Priority</span><div className="seg" role="group" aria-label="Priority">{DD_PRIORITIES.map((p) => <button key={p} type="button" aria-pressed={form.priority === p} onClick={() => setForm({ ...form, priority: p })}>{p}</button>)}</div></div>
        <Field label="What happened"><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the guest said, and what they want done" /></Field>
        <Field label="Assign to"><select className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>{DD_COMPLAINT_TEAMS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <label className="chk"><input type="checkbox" checked={form.repair} onChange={(e) => setForm({ ...form, repair: e.target.checked })} /> Something is broken: also send a repair ticket to Maintenance Desk</label>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={voidOpen && !!sel}
        onClose={() => setVoidOpen(false)}
        over="Complaints"
        title="Void this complaint"
        sub={sel ? `${sel.category} · ${sel.apartment}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoidOpen(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!voidReason.trim() || pending} onClick={() => sel && run(async () => { await callAction(voidComplaintAction)(sel.id, voidReason); setVoidOpen(false); })}>{pending ? "Voiding…" : "Void complaint"}</button></>}
      >
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>The original entry stays visible for the record. It’s only marked voided, with your reason.</p>
        {sel ? <p style={{ margin: 0, fontWeight: 600 }}>{sel.description}</p> : null}
        <Field label="Reason (required)"><textarea className="input" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Logged against the wrong apartment" /></Field>
      </Drawer>
    </>
  );
}
