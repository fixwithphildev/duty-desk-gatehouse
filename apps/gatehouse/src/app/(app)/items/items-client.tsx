"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarDays, Check, Package, PackageCheck, Plus, Search, Timer } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Drawer } from "@/components/drawer";
import { Badge, Kpi } from "@/components/suite";
import type { ItemLog } from "@/lib/data/items";
import { fmtDur, pl } from "@/lib/gate";
import { errorMessage, isRedirectError } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { bookItemInAction, logItemOutAction, voidItemAction } from "./actions";

type Tab = "out" | "back" | "all";
const TZ = "Africa/Lagos";
const dayKey = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const when = (iso: string, now: number) => {
  const t = new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (dayKey(iso) === dayKey(now)) return `Today ${t}`;
  if (dayKey(iso) === dayKey(now - 86400_000)) return `Yesterday ${t}`;
  return `${new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })}, ${t}`;
};
const EMPTY = { item: "", carriedBy: "", authorizedBy: "" };
const DAY = 24 * 60;

export function ItemsClient({ items, now, focusId, canEdit, canVoid }: { items: ItemLog[]; now: number; focusId: string | null; canEdit: boolean; canVoid: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("out");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<ItemLog | null>(null);
  const [reason, setReason] = useState("");
  const [rowErr, setRowErr] = useState<string | null>(null);

  const mins = (iso: string, to?: string | null) => Math.max(0, Math.round(((to ? new Date(to).getTime() : now) - new Date(iso).getTime()) / 60000));
  const live = items.filter((i) => !i.void);
  const outNow = live.filter((i) => i.status === "Out");
  const longOut = outNow.filter((i) => mins(i.out_at) >= DAY);
  const backToday = live.filter((i) => i.in_at && dayKey(i.in_at) === dayKey(now));
  const week = live.filter((i) => now - new Date(i.out_at).getTime() < 7 * 86400_000);

  useEffect(() => {
    if (!focusId) return;
    const it = items.find((i) => i.id === focusId);
    if (it && it.status !== "Out") setTab("all");
    setTimeout(() => document.getElementById(`it-${focusId}`)?.scrollIntoView({ block: "center" }), 50);
  }, [focusId, items]);

  const run = (fn: () => Promise<void>, onErr: (m: string) => void) =>
    start(async () => { try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; onErr(errorMessage(e)); } });

  const s = q.trim().toLowerCase();
  const list = items
    .filter((i) => (tab === "all" ? true : tab === "out" ? !i.void && i.status === "Out" : !i.void && i.status === "Returned"))
    .filter((i) => !s || `${i.item} ${i.carried_by} ${i.authorized_by ?? ""} ${i.logged_by_name ?? ""}`.toLowerCase().includes(s))
    .sort((a, b) => (tab === "out" ? a.out_at.localeCompare(b.out_at) : (b.in_at ?? b.out_at).localeCompare(a.in_at ?? a.out_at)));
  const n = (t: Tab) => (t === "all" ? items.length : t === "out" ? outNow.length : live.filter((i) => i.status === "Returned").length);

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Items Book</h1><p>Anything carried out through the gate: what it is, who carried it and who authorised it, until it’s booked back in.</p></div>
        <div className="acts">
          <AutoRefresh />
          {canEdit ? <button type="button" className="btn btn-primary" onClick={() => { setF(EMPTY); setError(null); setOpen(true); }}><Plus size={15} /> Log item out</button> : null}
        </div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Package} label="Out now" value={outNow.length} ctx={outNow[0] ? `oldest ${fmtDur(mins([...outNow].sort((a, b) => a.out_at.localeCompare(b.out_at))[0].out_at))}` : "everything is back"} />
        <Kpi icon={Timer} label="Out over a day" value={longOut.length} ctx={longOut.length ? "check they’re coming back" : "none"} tile={longOut.length ? "warn" : ""} />
        <Kpi icon={PackageCheck} label="Booked back in today" value={backToday.length} ctx={backToday[0] ? `last: ${backToday.sort((a, b) => (b.in_at ?? "").localeCompare(a.in_at ?? ""))[0].item}` : "nothing yet"} />
        <Kpi icon={CalendarDays} label="Logged out this week" value={week.length} ctx="last 7 days" />
      </div>

      <section className="card">
        <div className="tabs" role="tablist">
          {([["out", "Out now"], ["back", "Back in"], ["all", "All"]] as [Tab, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{n(k)}</span></button>)}
        </div>
        <div className="hstack" style={{ padding: "12px 20px", borderBottom: "1px solid var(--line-soft)" }}>
          <div className="input-wrap" style={{ maxWidth: 360, flex: 1 }}><Search size={15} /><input className="input" style={{ height: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, carrier or who authorised" aria-label="Search items" /></div>
        </div>
        {rowErr ? <div className="err-note" role="alert" style={{ margin: "12px 20px 0" }}>{rowErr}</div> : null}
        <ul className="list">
          {list.map((i) => {
            const m = mins(i.out_at, i.in_at);
            const tone = i.void ? "neu" : i.status === "Returned" ? "ok" : m >= DAY ? "warn" : "info";
            return (
              <li key={i.id} id={`it-${i.id}`} className="row" style={{ ...(i.void ? { opacity: 0.55 } : {}), ...(focusId === i.id ? { background: "var(--acc-bg)" } : {}) }}>
                <span className={`stripe s-${tone}`} />
                <div className="m">
                  <b>{i.item}</b>
                  <span>Carried by {i.carried_by}{i.authorized_by ? ` · authorised by ${i.authorized_by}` : " · no authorisation noted"} · out {when(i.out_at, now)}{i.logged_by_name ? ` by ${i.logged_by_name}` : ""}{i.in_at ? ` · back ${when(i.in_at, now)}${i.in_by_name ? ` (${i.in_by_name})` : ""}` : ""}</span>
                  {i.void ? <span style={{ display: "block" }}>Voided{i.voided_by_name ? ` by ${i.voided_by_name}` : ""}: {i.void_reason}</span> : null}
                </div>
                {i.void ? <Badge tone="neu" dot={false}>Voided</Badge> : i.status === "Returned" ? <Badge tone="ok" dot={false}>Back · {fmtDur(m)}</Badge> : <span className="age" style={{ color: m >= DAY ? "var(--warn-fg)" : undefined }}>out {fmtDur(m)}</span>}
                {canEdit && !i.void && i.status === "Out" ? <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => { setRowErr(null); run(() => callAction(bookItemInAction)(i.id), setRowErr); }}><Check size={14} /> Book in</button> : null}
                {canVoid && !i.void ? <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Void ${i.item}`} title="Void" onClick={() => { setReason(""); setRowErr(null); setVoiding(i); }}><Ban size={13} /></button> : null}
              </li>
            );
          })}
          {list.length === 0 ? <li className="empty">{s ? "Nothing matches that search." : tab === "out" ? "Nothing is out right now." : "Nothing here yet."}</li> : null}
        </ul>
      </section>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Items Book"
        title="Log an item going out"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={() => { setError(null); run(async () => { await callAction(logItemOutAction)(f); setOpen(false); setF(EMPTY); }, setError); }}><Plus size={15} /> {pending ? "Saving…" : "Log item out"}</button></>}
      >
        <div className="field"><label htmlFor="it-what">What is going out</label><input className="input" id="it-what" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="e.g. 2 extension reels, aluminium ladder" autoFocus /></div>
        <div className="field"><label htmlFor="it-who">Carried by</label><input className="input" id="it-who" value={f.carriedBy} onChange={(e) => setF({ ...f, carriedBy: e.target.value })} placeholder="Full name" /></div>
        <div className="field"><label htmlFor="it-auth">Authorised by <span className="muted">(optional)</span></label><input className="input" id="it-auth" value={f.authorizedBy} onChange={(e) => setF({ ...f, authorizedBy: e.target.value })} placeholder="Who allowed it out, e.g. the Maintenance Manager" /></div>
        <span className="hint">It shows as out until someone at the gate books it back in.</span>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={!!voiding}
        onClose={() => setVoiding(null)}
        over="Items Book"
        title={voiding ? `Void: ${voiding.item}` : ""}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoiding(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!reason.trim() || pending} onClick={() => voiding && run(async () => { await callAction(voidItemAction)(voiding.id, reason); setVoiding(null); }, setRowErr)}>{pending ? "Voiding…" : "Void entry"}</button></>}
      >
        <p className="muted" style={{ margin: 0 }}>For mistakes and duplicates. The entry stays on record, marked voided with your reason.</p>
        <div className="field"><label htmlFor="it-reason">Reason (required)</label><textarea className="input" id="it-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {rowErr ? <div className="err-note" role="alert">{rowErr}</div> : null}
      </Drawer>
    </>
  );
}
