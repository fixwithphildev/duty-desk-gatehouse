"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Camera, Check, ClipboardCheck, MessageSquare, Paperclip, Plus, Search, UserRound, Wrench } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, priTone, stTone } from "@/components/suite";
import { StartPrepButton, type DraftInfo } from "@/components/start-prep-button";
import { DD_PRIORITIES, DD_TICKET_DEPTS } from "@/lib/checklist-data";
import { aptKey, aptWhere, findApartment, suggestApartments } from "@/lib/apartments";
import { shrinkPhoto } from "@/lib/photo";
import { isRedirectError, errorMessage } from "@/lib/utils";
import type { MaintenanceTicketRow } from "@/lib/data/maintenance";
import type { ReadyStatus } from "@/lib/data/readiness";
import { addTicketPhotoAction, assignTicketAction, createTicketAction, getTicketPhotosAction, updateTicketStatusAction, voidTicketAction } from "./actions";

export interface TicketView extends MaintenanceTicketRow {
  apartment: string | null;
  where: string | null;
  openedWhen: string;
  updatedWhen: string | null;
  voidedWhen: string | null;
  startedWhen: string | null;
  resolvedWhen: string | null;
  ref: string | null;
  age: string;
  complaintId: string | null;
  checklistId: string | null;
}

export interface AptState {
  status: ReadyStatus;
  // Not ready, and every repair it's waiting on is resolved: it needs a new check-in prep.
  repairsDone: boolean;
  draft: DraftInfo | null;
}

type Priority = "Low" | "Medium" | "High";
type Tab = "open" | "resolved" | "all";
type Status = MaintenanceTicketRow["status"];
const STAGES: Status[] = ["Reported", "In Progress", "Resolved"];
const AREAS = ["Lobby", "Car park", "Generator house", "Pool deck", "Main Building corridor", "Studio Wings corridor"];
const PRI_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const EMPTY = { area: "", issue: "", dept: "General Maintenance", priority: "Medium" as Priority, notes: "", blocksSale: true };

const stLabel = (s: string) => (s === "In Progress" ? "In progress" : s);
const srcLabel = (t: TicketView) =>
  t.source === "checklist" ? "Check-in prep" : t.source === "complaint" ? "Complaint" : t.source === "report" ? "Problem report" : t.opened_by_name ? "Logged by hand" : "Maintenance Desk";
const tm = (when: string) => when.replace(/^Today /, "");

export function MaintenanceClient({
  tickets,
  apts,
  initialId,
  canEdit,
  canVoid,
  canPrep,
  me,
}: {
  tickets: TicketView[];
  apts: Record<string, AptState>;
  initialId: string | null;
  canEdit: boolean;
  canVoid: boolean;
  canPrep: boolean;
  me: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [dept, setDept] = useState("all");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(initialId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [areaFocus, setAreaFocus] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [photos, setPhotos] = useState<{ id: string; urls: string[] } | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const inTab = (t: TicketView, k: Tab) => k === "all" || (k === "open" ? t.status !== "Resolved" && !t.void : t.status === "Resolved" || t.void);
  const s = q.trim().toLowerCase();
  const list = tickets
    .filter((t) => inTab(t, tab) && (dept === "all" || t.assigned_to === dept) && (!s || `${t.issue_type} ${t.area} ${t.notes ?? ""} ${t.assigned_to}`.toLowerCase().includes(s)))
    .sort((a, b) => (tab === "open" ? PRI_ORDER[a.priority] - PRI_ORDER[b.priority] : 0) || b.created_at.localeCompare(a.created_at));
  const sel = tickets.find((t) => t.id === selId) ?? list[0] ?? null;
  const apt = sel?.apartment ? apts[aptKey(sel.apartment)] ?? null : null;

  useEffect(() => {
    if (initialId) { const t = tickets.find((x) => x.id === initialId); if (t && !inTab(t, "open")) setTab("all"); }
  }, [initialId]);
  useEffect(() => { setActError(null); }, [sel?.id]);

  // Photos are signed links that expire, so they're fetched when a ticket is opened.
  const photoCount = sel?.photo_count ?? 0;
  useEffect(() => {
    if (!sel || !photoCount) return setPhotos(null);
    let gone = false;
    getTicketPhotosAction(sel.id).then((urls) => { if (!gone) setPhotos({ id: sel.id, urls }); }).catch(() => {});
    return () => { gone = true; };
  }, [sel?.id, photoCount]);

  const pick = (id: string) => {
    setSelId(id);
    if (window.matchMedia("(max-width: 900px)").matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const run = (fn: () => Promise<void>) => {
    setActError(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setActError(errorMessage(e)); }
    });
  };

  const formApt = findApartment(form.area);
  const areaSugg = form.area.trim() && !formApt
    ? [...suggestApartments(form.area, 5).map((a) => ({ name: a.name, sub: aptWhere(a) })), ...AREAS.filter((a) => a.toLowerCase().includes(form.area.trim().toLowerCase())).map((a) => ({ name: a, sub: "Common area" }))].slice(0, 7)
    : [];

  const submit = () => {
    if (!form.area.trim()) return setError("Say which apartment or area.");
    if (!form.issue.trim()) return setError("Describe the issue.");
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("area", formApt ? formApt.name : form.area.trim());
        fd.set("issueType", form.issue.trim());
        fd.set("assignedTo", form.dept);
        fd.set("priority", form.priority);
        fd.set("notes", form.notes);
        if (formApt && form.blocksSale) fd.set("blocksSale", "on");
        if (photo) fd.set("photo", await shrinkPhoto(photo));
        const r = await createTicketAction(fd);
        setForm(EMPTY);
        setPhoto(null);
        setOpen(false);
        setTab("open");
        setDept("all");
        setQ("");
        setSelId(r.id);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const addPhoto = (file: File | undefined) => {
    if (!file || !sel) return;
    run(async () => {
      const fd = new FormData();
      fd.set("id", sel.id);
      fd.set("photo", await shrinkPhoto(file));
      await addTicketPhotoAction(fd);
    });
    if (photoRef.current) photoRef.current.value = "";
  };

  const tabN = (k: Tab) => tickets.filter((t) => inTab(t, k)).length;
  const si = sel ? STAGES.indexOf(sel.status) : 0;
  const blocked = !!sel && !sel.void && apt?.status === "notready";

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Maintenance</h1><p>Repair tickets shared with Maintenance Desk. Flags in a check-in prep, problem reports and complaints open them automatically.</p></div>
        <div className="acts">
          <AutoRefresh />
          {canEdit ? <button type="button" className="btn btn-primary" onClick={() => { setForm(EMPTY); setPhoto(null); setError(null); setOpen(true); }}><Plus size={15} /> New ticket</button> : null}
        </div>
      </div>

      <div className="g g-main g-split-a">
        <section className="card">
          <div className="tabs" role="tablist" style={{ paddingTop: 4 }}>
            {([["open", "Open"], ["resolved", "Resolved"], ["all", "All"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{tabN(k)}</span></button>
            ))}
          </div>
          <div className="vstack" style={{ padding: "12px 16px", gap: 10, borderBottom: "1px solid var(--line-soft)" }}>
            <div className="seg" role="group" aria-label="Department" style={{ flexWrap: "wrap" }}>
              {["all", ...DD_TICKET_DEPTS].map((d) => <button key={d} type="button" aria-pressed={dept === d} onClick={() => setDept(d)}>{d === "all" ? "All" : d}</button>)}
            </div>
            <div className="input-wrap"><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issue, apartment or notes" style={{ height: 36 }} autoComplete="off" aria-label="Search tickets" /></div>
          </div>
          <ul className="list">
            {list.map((t) => (
              <li key={t.id} className="row click" onClick={() => pick(t.id)} style={sel?.id === t.id ? { background: "var(--acc-bg)" } : undefined}>
                <span className={`stripe s-${t.void ? "neu" : priTone(t.priority)}`} />
                <div className="m">
                  <b>{t.issue_type} · {t.apartment ?? t.area}</b>
                  <span>{t.assigned_to} · {srcLabel(t).toLowerCase()}{t.photo_count ? <> · <Paperclip size={11} style={{ verticalAlign: "-1px" }} /> {t.photo_count}</> : null}</span>
                </div>
                <div className="vstack" style={{ alignItems: "flex-end", gap: 4 }}>
                  {t.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={stTone(t.status)}>{stLabel(t.status)}</Badge>}
                  <span className="age">{t.age}</span>
                </div>
              </li>
            ))}
            {list.length === 0 ? <li className="empty" style={{ padding: "24px 16px" }}>{tickets.length === 0 ? "No repair tickets yet." : s ? `No tickets match “${q.trim()}”.` : tab === "open" ? `No open tickets${dept !== "all" ? ` for ${dept}` : ""}.` : `No tickets here${dept !== "all" ? ` for ${dept}` : ""}.`}</li> : null}
          </ul>
        </section>

        {sel ? (
          <section className="card" ref={detailRef} style={{ scrollMarginTop: 72 }}>
            <div className="card-h" style={{ alignItems: "flex-start" }}>
              <div className="vstack" style={{ gap: 4, flex: 1 }}>
                <span className="mono muted" style={{ fontSize: 12 }}>{sel.ref ? `${sel.ref} · ` : ""}{srcLabel(sel)} · opened {sel.openedWhen}</span>
                <h3 style={{ fontSize: 18 }}>{sel.issue_type}</h3>
                <div className="hstack">
                  <Badge tone={priTone(sel.priority)}>{sel.priority} priority</Badge>
                  {sel.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={stTone(sel.status)}>{stLabel(sel.status)}</Badge>}
                  {blocked ? <Badge tone="bad">{sel.apartment} can’t be sold</Badge> : null}
                </div>
              </div>
            </div>
            <div className="card-b vstack" style={{ gap: 20 }}>
              {!sel.void ? <div className="steps">{STAGES.map((st, i) => <div key={st} className={i <= si ? "done" : ""}>{stLabel(st)}</div>)}</div> : null}
              <dl className="kv">
                <dt>{sel.apartment ? "Apartment" : "Area"}</dt>
                <dd>{sel.apartment ? <><Link className="link" href={`/board?apt=${encodeURIComponent(sel.apartment)}`}>{sel.apartment}</Link> <span className="muted">· {sel.where}</span></> : sel.area}</dd>
                <dt>Assigned to</dt>
                <dd>
                  {canEdit && !sel.void && sel.status !== "Resolved" ? (
                    <select className="input" style={{ height: 34, maxWidth: 240 }} value={sel.assigned_to} disabled={pending} onChange={(e) => run(() => assignTicketAction(sel.id, e.target.value))} aria-label="Assign department">
                      {[...new Set([...DD_TICKET_DEPTS, sel.assigned_to])].map((d) => <option key={d}>{d}</option>)}
                    </select>
                  ) : sel.assigned_to}
                </dd>
                <dt>Opened by</dt>
                <dd>
                  {sel.opened_by_name ?? (sel.source === "checklist" ? "Check-in prep" : "Maintenance Desk")}
                  {sel.complaintId ? <> · <Link className="link" href={`/complaints?id=${sel.complaintId}`}>from a complaint</Link></> : null}
                  {sel.checklistId ? <> · <Link className="link" href={`/checklists/${sel.checklistId}`}>from a checklist</Link></> : null}
                </dd>
                {sel.started_by_name ? <><dt>Started</dt><dd>{sel.started_by_name} · {sel.startedWhen}</dd></> : null}
                {sel.status === "Resolved" && sel.resolved_by_name ? <><dt>Fixed by</dt><dd><b>{sel.resolved_by_name}</b> · {sel.assigned_to} · {sel.resolvedWhen}</dd></> : null}
                {sel.fix_note ? <><dt>What was done</dt><dd>{sel.fix_note}</dd></> : null}
                {sel.updatedWhen && sel.logged_by_name && !sel.started_by_name && !sel.resolved_by_name ? <><dt>Last update</dt><dd>{sel.logged_by_name} · {sel.updatedWhen}</dd></> : null}
                {sel.notes ? <><dt>Notes</dt><dd style={{ whiteSpace: "pre-line" }}>{sel.notes}</dd></> : null}
                {sel.void ? <><dt>Voided</dt><dd>{sel.voided_by_name} · {sel.void_reason}</dd></> : null}
              </dl>

              {sel.photo_count || (canEdit && !sel.void) ? (
                <div className="vstack" style={{ gap: 8 }}>
                  <span className="over">Photos</span>
                  <div className="photos">
                    {photos?.id === sel.id ? photos.urls.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Photo ${i + 1} of ${sel.issue_type}`} /></a>) : sel.photo_count ? <span className="hint">Loading {sel.photo_count} photo{sel.photo_count > 1 ? "s" : ""}…</span> : null}
                    {canEdit && !sel.void ? (
                      <label className="photo-add">
                        <Camera size={16} /><span>Add photo</span>
                        <input ref={photoRef} type="file" accept="image/*" capture="environment" disabled={pending} onChange={(e) => addPhoto(e.target.files?.[0])} />
                      </label>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {sel.status === "Resolved" && !sel.void && apt?.repairsDone && sel.apartment ? (
                <>
                  <div className="pill-note t-info"><ClipboardCheck size={16} /><span>All repairs in {sel.apartment} are done. It stays Not ready until a Resident Officer submits a check-in prep as Ready.</span></div>
                  {canPrep ? <div><StartPrepButton apartment={sel.apartment} draft={apt.draft} primary /></div> : null}
                </>
              ) : null}

              {actError ? <div className="err-note" role="alert">{actError}</div> : null}
              {!sel.void ? (
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  {canVoid ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVoidReason(""); setVoidOpen(true); }}><Ban size={13} /> Void</button> : <span className="hint">Only a manager can void a ticket.</span>}
                  {canEdit ? (
                    <div className="hstack">
                      {si < 1 ? <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => updateTicketStatusAction(sel.id, "In Progress"))}>Mark in progress</button> : null}
                      {si < 2 ? <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => updateTicketStatusAction(sel.id, "Resolved"))}><Check size={14} /> Resolve</button>
                        : <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => updateTicketStatusAction(sel.id, "Reported"))}>Reopen</button>}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <hr className="sep" />
              <div className="vstack">
                <span className="over">Activity</span>
                <ul className="tl" style={{ padding: 0 }}>
                  <li><span className="tm">{tm(sel.openedWhen)}</span><span className="dt">{sel.source === "complaint" ? <MessageSquare size={11} /> : <Wrench size={11} />}</span><span className="tx"><b>{sel.opened_by_name ?? (sel.source === "checklist" ? "Check-in prep" : "Maintenance Desk")}</b> opened the ticket for {sel.assigned_to}</span></li>
                  {sel.started_by_name && sel.startedWhen ? <li><span className="tm">{tm(sel.startedWhen)}</span><span className="dt"><UserRound size={11} /></span><span className="tx"><b>{sel.started_by_name}</b> ({sel.assigned_to}) started work</span></li> : null}
                  {sel.status === "Resolved" && sel.resolved_by_name && sel.resolvedWhen ? <li><span className="tm">{tm(sel.resolvedWhen)}</span><span className="dt"><Check size={11} /></span><span className="tx"><b>{sel.resolved_by_name}</b> ({sel.assigned_to}) fixed it{sel.fix_note ? `: ${sel.fix_note}` : ""}</span></li> : null}
                  {!sel.started_by_name && !sel.resolved_by_name && sel.updatedWhen && sel.logged_by_name ? <li><span className="tm">{tm(sel.updatedWhen)}</span><span className="dt">{sel.status === "Resolved" ? <Check size={11} /> : <UserRound size={11} />}</span><span className="tx"><b>{sel.logged_by_name}</b> {sel.status === "Resolved" ? "marked it resolved" : sel.status === "In Progress" ? "started work" : "updated it"}</span></li> : null}
                  {sel.voidedWhen ? <li><span className="tm">{tm(sel.voidedWhen)}</span><span className="dt"><Ban size={11} /></span><span className="tx"><b>{sel.voided_by_name}</b> voided it: {sel.void_reason}</span></li> : null}
                </ul>
              </div>
            </div>
          </section>
        ) : (
          <section className="card empty">{tickets.length === 0 ? "No repair tickets yet." : tab === "open" ? "Nothing open right now. Finished tickets are under Resolved and All." : "Nothing to show here."}</section>
        )}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Maintenance"
        title="New ticket"
        sub="Goes to Maintenance Desk straight away"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Plus size={15} /> {pending ? "Sending…" : "Create ticket"}</button></>}
      >
        <div className="field gsearch">
          <label htmlFor="mt-area">Apartment or area</label>
          <input className="input" id="mt-area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} onFocus={() => setAreaFocus(true)} onBlur={() => setTimeout(() => setAreaFocus(false), 150)} placeholder="e.g. Lisbon, Car park" autoComplete="off" />
          {areaFocus && areaSugg.length ? (
            <div className="sugg" role="listbox">{areaSugg.map((a) => <button key={a.name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setForm({ ...form, area: a.name }); setAreaFocus(false); }}><b>{a.name}</b><span>{a.sub}</span></button>)}</div>
          ) : null}
          {formApt ? <span className="hint">{formApt.name} · {aptWhere(formApt)}</span> : null}
        </div>
        <Field label="Issue"><input className="input" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} placeholder="e.g. Leaking tap" /></Field>
        <div className="field"><span className="flabel">Assign to</span><div className="seg" role="group" aria-label="Assign to" style={{ flexWrap: "wrap" }}>{DD_TICKET_DEPTS.map((d) => <button key={d} type="button" aria-pressed={form.dept === d} onClick={() => setForm({ ...form, dept: d })}>{d}</button>)}</div></div>
        <div className="field"><span className="flabel">Priority</span><div className="seg" role="group" aria-label="Priority">{DD_PRIORITIES.map((p) => <button key={p} type="button" aria-pressed={form.priority === p} onClick={() => setForm({ ...form, priority: p })}>{p}</button>)}</div></div>
        <Field label="Notes (optional)"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything that helps them find or fix it" /></Field>
        <label className="photo-add" style={{ alignSelf: "flex-start", width: "auto", height: "auto", padding: "8px 12px", flexDirection: "row" }}>
          <Camera size={15} /><span>{photo ? photo.name : "Add photo"}</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        {formApt ? <label className="chk"><input type="checkbox" checked={form.blocksSale} onChange={(e) => setForm({ ...form, blocksSale: e.target.checked })} /> If {formApt.name} is empty, stop it being sold until it’s fixed and checked again</label> : null}
        {error ? <div className="err-note" role="alert">{error}</div> : null}
        <span className="hint">Logged by {me}</span>
      </Drawer>

      <Drawer
        open={voidOpen && !!sel}
        onClose={() => setVoidOpen(false)}
        over="Maintenance"
        title="Void this ticket"
        sub={sel ? `${sel.issue_type} · ${sel.apartment ?? sel.area}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoidOpen(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!voidReason.trim() || pending} onClick={() => sel && run(async () => { await voidTicketAction(sel.id, voidReason); setVoidOpen(false); })}>{pending ? "Voiding…" : "Void ticket"}</button></>}
      >
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>The ticket stays visible for the record, on Maintenance Desk too. It’s only marked voided, with your reason.</p>
        <Field label="Reason (required)"><textarea className="input" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Duplicate of another ticket" /></Field>
      </Drawer>
    </>
  );
}
