"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarDays, Check, CheckCircle2, Plus, RotateCcw, Search, TriangleAlert } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Drawer } from "@/components/drawer";
import { Badge, Kpi } from "@/components/suite";
import type { Incident } from "@/lib/data/incidents";
import { GH_INCIDENT_CATEGORIES, GH_PLACES } from "@/lib/constants";
import { GH_SEVERITIES, incTone, sevTone, type IncidentStatus, type Severity } from "@/lib/types";
import { fmtDur } from "@/lib/gate";
import { errorMessage, isRedirectError } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { createIncidentAction, setIncidentStatusAction, voidIncidentAction } from "./actions";

type Tab = "open" | "resolved" | "all";
const TZ = "Africa/Lagos";
const dayKey = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const when = (iso: string, now: number) => {
  const t = new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (dayKey(iso) === dayKey(now)) return `Today ${t}`;
  if (dayKey(iso) === dayKey(now - 86400_000)) return `Yesterday ${t}`;
  return `${new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })}, ${t}`;
};
const EMPTY = { title: "", category: "Other", severity: "Low", location: "", description: "" };
const stLabel = (s: string) => (s === "In Progress" ? "In progress" : s);

export function IncidentsClient({ incidents, now, initialId, canEdit, canVoid }: { incidents: Incident[]; now: number; initialId: string | null; canEdit: boolean; canVoid: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("open");
  const [sev, setSev] = useState<"all" | Severity>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialId);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [step, setStep] = useState<null | "resolve" | "void">(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const i = incidents.find((x) => x.id === initialId); if (i && (i.status === "Resolved" || i.void)) setTab("all"); }, [initialId, incidents]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("id", openId); else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
    setStep(null); setNotes(""); setError(null);
  }, [openId]);

  const run = (fn: () => Promise<void>) =>
    start(async () => { try { setError(null); await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); } });

  const live = incidents.filter((i) => !i.void);
  const open = live.filter((i) => i.status !== "Resolved");
  const hi = open.filter((i) => i.severity === "High" || i.severity === "Critical");
  const week = live.filter((i) => now - new Date(i.created_at).getTime() < 7 * 86400_000);
  const resolvedWeek = live.filter((i) => i.resolved_at && now - new Date(i.resolved_at).getTime() < 7 * 86400_000);
  const avgFix = resolvedWeek.length ? Math.round(resolvedWeek.reduce((a, i) => a + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()) / 60000, 0) / resolvedWeek.length) : 0;

  const inTab = (i: Incident, t: Tab) => (t === "all" ? true : t === "open" ? !i.void && i.status !== "Resolved" : !i.void && i.status === "Resolved");
  const s = q.trim().toLowerCase();
  const list = incidents
    .filter((i) => inTab(i, tab) && (sev === "all" || i.severity === sev))
    .filter((i) => !s || `${i.ref} ${i.title} ${i.category} ${i.location ?? ""} ${i.reported_by_name} ${i.description ?? ""}`.toLowerCase().includes(s))
    .sort((a, b) => (tab === "open" ? GH_SEVERITIES.indexOf(b.severity) - GH_SEVERITIES.indexOf(a.severity) || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at)));
  const sel = incidents.find((i) => i.id === openId) ?? null;
  const si = sel ? ["Open", "In Progress", "Resolved"].indexOf(sel.status) : 0;

  const setStatus = (status: IncidentStatus, n = "") => sel && run(() => callAction(setIncidentStatusAction)(sel.id, status, n));

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Incidents</h1><p>What happened, where and how serious, and how it was resolved. High and Critical incidents chime on every Gatehouse screen.</p></div>
        <div className="acts">
          <AutoRefresh />
          {canEdit ? <button type="button" className="btn btn-primary" onClick={() => { setF(EMPTY); setError(null); setCreating(true); }}><Plus size={15} /> Log incident</button> : null}
        </div>
      </div>

      <div className="kpis k4">
        <Kpi icon={TriangleAlert} label="Open" value={open.length} ctx={`${open.filter((i) => i.status === "In Progress").length} in progress`} />
        <Kpi icon={TriangleAlert} label="High or critical open" value={hi.length} ctx={hi[0] ? hi[0].title : "none"} tile={hi.length ? "bad" : ""} />
        <Kpi icon={CalendarDays} label="Logged this week" value={week.length} ctx="last 7 days" />
        <Kpi icon={CheckCircle2} label="Resolved this week" value={resolvedWeek.length} ctx={avgFix ? `on average in ${fmtDur(avgFix)}` : "last 7 days"} />
      </div>

      <section className="card">
        <div className="tabs" role="tablist">
          {([["open", "Open"], ["resolved", "Resolved"], ["all", "All"]] as [Tab, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{incidents.filter((i) => inTab(i, k)).length}</span></button>)}
        </div>
        <div className="hstack" style={{ padding: "12px 20px", borderBottom: "1px solid var(--line-soft)", justifyContent: "space-between" }}>
          <div className="seg" role="group" aria-label="Severity">{(["all", ...GH_SEVERITIES] as ("all" | Severity)[]).map((k) => <button key={k} type="button" aria-pressed={sev === k} onClick={() => setSev(k)}>{k === "all" ? "All" : k}</button>)}</div>
          <div className="input-wrap" style={{ maxWidth: 320, flex: 1 }}><Search size={15} /><input className="input" style={{ height: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search incidents" aria-label="Search incidents" /></div>
        </div>
        <ul className="list">
          {list.map((i) => (
            <li key={i.id}>
              <button type="button" className="row click" onClick={() => setOpenId(i.id)} style={{ width: "100%", textAlign: "left", background: openId === i.id ? "var(--acc-bg)" : "transparent", border: 0, color: "inherit", ...(i.void ? { opacity: 0.55 } : {}) }}>
                <span className={`stripe s-${i.void ? "neu" : sevTone(i.severity)}`} />
                <div className="m"><b>{i.title}</b><span><span className="mono">{i.ref}</span> · {i.category} · {i.location ?? "no location"} · {i.reported_by_name} · {when(i.created_at, now)}</span></div>
                {i.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={incTone(i.status)}>{stLabel(i.status)}</Badge>}
                <Badge tone={sevTone(i.severity)} dot={false}>{i.severity}</Badge>
              </button>
            </li>
          ))}
          {list.length === 0 ? <li className="empty">{s || sev !== "all" ? "Nothing matches." : tab === "open" ? "No open incidents." : "No incidents yet."}</li> : null}
        </ul>
      </section>

      <Drawer
        open={!!sel}
        onClose={() => setOpenId(null)}
        over={sel ? `${sel.ref} · ${sel.category}` : ""}
        title={sel?.title ?? ""}
        sub={sel ? <span className="hstack"><Badge tone={sevTone(sel.severity)} dot={false}>{sel.severity}</Badge>{sel.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={incTone(sel.status)}>{stLabel(sel.status)}</Badge>}</span> : undefined}
        footer={sel && !sel.void ? (
          <>
            {canVoid ? <button type="button" className="btn btn-ghost" onClick={() => { setNotes(""); setStep("void"); }}><Ban size={15} /> Void</button> : null}
            <span style={{ flex: 1 }} />
            {canEdit && sel.status === "Open" && !step ? <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setStatus("In Progress")}>Mark in progress</button> : null}
            {canEdit && sel.status !== "Resolved" && !step ? <button type="button" className="btn btn-primary" onClick={() => { setNotes(""); setStep("resolve"); }}><Check size={15} /> Resolve</button> : null}
            {canEdit && sel.status === "Resolved" && !step ? <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setStatus("Open")}><RotateCcw size={15} /> Reopen</button> : null}
            {step === "resolve" ? <><button type="button" className="btn btn-ghost" onClick={() => setStep(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending || !notes.trim()} onClick={() => setStatus("Resolved", notes)}><Check size={15} /> {pending ? "Saving…" : "Mark resolved"}</button></> : null}
            {step === "void" ? <><button type="button" className="btn btn-ghost" onClick={() => setStep(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={pending || !notes.trim()} onClick={() => run(async () => { await callAction(voidIncidentAction)(sel.id, notes); setStep(null); })}>{pending ? "Voiding…" : "Void incident"}</button></> : null}
          </>
        ) : undefined}
      >
        {sel ? (
          <>
            {!sel.void ? <div className="steps">{["Open", "In progress", "Resolved"].map((x, k) => <div key={x} className={k <= si ? "done" : ""}>{x}</div>)}</div> : null}
            {step === "resolve" ? (
              <div className="work-box">
                <span className="over">Resolve</span>
                <div className="field"><label htmlFor="in-notes">How it was resolved</label><textarea className="input" id="in-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Door locked, Facilities told to fix the latch. Nothing missing." autoFocus /></div>
              </div>
            ) : null}
            {step === "void" ? (
              <div className="work-box">
                <span className="over">Void this incident</span>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>For mistakes and duplicates. It stays on record, marked voided with your reason.</p>
                <div className="field"><label htmlFor="in-void">Reason (required)</label><textarea className="input" id="in-void" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={`e.g. Duplicate of ${sel.ref}`} autoFocus /></div>
              </div>
            ) : null}
            {error ? <div className="err-note" role="alert">{error}</div> : null}
            <dl className="kv">
              <dt>Location</dt><dd>{sel.location ?? "—"}</dd>
              <dt>Reported by</dt><dd>{sel.reported_by_name}</dd>
              <dt>Logged</dt><dd>{when(sel.created_at, now)}</dd>
              <dt>What happened</dt><dd style={{ whiteSpace: "pre-wrap" }}>{sel.description ?? "—"}</dd>
              {sel.status === "Resolved" ? <><dt>Resolved</dt><dd>{sel.resolved_at ? when(sel.resolved_at, now) : "—"}{sel.resolved_by_name ? ` by ${sel.resolved_by_name}` : ""}{sel.resolved_at ? ` · after ${fmtDur(Math.round((new Date(sel.resolved_at).getTime() - new Date(sel.created_at).getTime()) / 60000))}` : ""}</dd><dt>How</dt><dd style={{ whiteSpace: "pre-wrap" }}>{sel.resolution_notes ?? "—"}</dd></> : null}
              {sel.void ? <><dt>Voided</dt><dd>{sel.voided_by_name ?? "—"}: {sel.void_reason}</dd></> : null}
            </dl>
            {!canEdit ? <span className="hint">View only. Officers, the Supervisor and the Admin update incidents.</span> : null}
          </>
        ) : null}
      </Drawer>

      <Drawer
        open={creating}
        onClose={() => setCreating(false)}
        over="Incidents"
        title="Log an incident"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(async () => { const r = await callAction(createIncidentAction)(f); setCreating(false); setF(EMPTY); setTab("open"); setOpenId(r.id); })}><Plus size={15} /> {pending ? "Saving…" : "Log incident"}</button></>}
      >
        <div className="field"><label htmlFor="ni-title">What happened, in a few words</label><input className="input" id="ni-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Unlocked storage door, Block C" autoFocus /></div>
        <div className="field"><span className="flabel">Category</span><div className="seg" role="group" aria-label="Category">{GH_INCIDENT_CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={f.category === c} onClick={() => setF({ ...f, category: c })}>{c}</button>)}</div></div>
        <div className="field"><span className="flabel">Severity</span><div className="seg" role="group" aria-label="Severity">{GH_SEVERITIES.map((x) => <button key={x} type="button" aria-pressed={f.severity === x} onClick={() => setF({ ...f, severity: x })}>{x}</button>)}</div><span className="hint">High and Critical chime on every Gatehouse screen. For a fire or an emergency, raise an alert as well.</span></div>
        <div className="field">
          <label htmlFor="ni-loc">Location</label>
          <input className="input" id="ni-loc" list="ni-places" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Block C basement" autoComplete="off" />
          <datalist id="ni-places">{GH_PLACES.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="ni-desc">Details <span className="muted">(optional)</span></label><textarea className="input" id="ni-desc" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Who, what, what you did" /></div>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>
    </>
  );
}
