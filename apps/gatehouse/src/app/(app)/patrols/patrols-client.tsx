"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarDays, Check, Clock, Footprints, Play, Route } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Drawer } from "@/components/drawer";
import { Badge, Kpi } from "@/components/suite";
import type { Patrol } from "@/lib/data/patrols";
import { fmtDur, pl } from "@/lib/gate";
import { errorMessage, isRedirectError } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { finishPatrolAction, startPatrolAction, voidPatrolAction } from "./actions";

const TZ = "Africa/Lagos";
const dayKey = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const day = (iso: string, now: number) => (dayKey(iso) === dayKey(now) ? "Today" : dayKey(iso) === dayKey(now - 86400_000) ? "Yesterday" : new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }));

export function PatrolsClient({ patrols, now, meId, canEdit, canFinishAny, canVoid }: { patrols: Patrol[]; now: number; meId: string; canEdit: boolean; canFinishAny: boolean; canVoid: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [starting, setStarting] = useState(false);
  const [route, setRoute] = useState("");
  const [finishing, setFinishing] = useState<Patrol | null>(null);
  const [notes, setNotes] = useState("");
  const [voiding, setVoiding] = useState<Patrol | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mins = (from: string, to?: string | null) => Math.max(0, Math.round(((to ? new Date(to).getTime() : now) - new Date(from).getTime()) / 60000));
  const live = patrols.filter((p) => !p.void);
  const active = live.filter((p) => p.status === "In Progress");
  const mine = active.find((p) => p.officer_id === meId);
  const today = live.filter((p) => dayKey(p.started_at) === dayKey(now));
  const week = live.filter((p) => p.status === "Completed" && p.ended_at && now - new Date(p.started_at).getTime() < 7 * 86400_000);
  const avg = week.length ? Math.round(week.reduce((a, p) => a + mins(p.started_at, p.ended_at), 0) / week.length) : 0;
  const routes = [...new Set(live.map((p) => p.route))].slice(0, 30);
  const history = patrols.filter((p) => p.void || p.status === "Completed").slice(0, 200);

  const run = (fn: () => Promise<void>) =>
    start(async () => { try { setError(null); await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); } });

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Patrols</h1><p>Who is walking which route, and what they found. Start a patrol when you set off and finish it with notes when you’re back.</p></div>
        <div className="acts">
          <AutoRefresh />
          {canEdit && !mine ? <button type="button" className="btn btn-primary" onClick={() => { setRoute(""); setError(null); setStarting(true); }}><Play size={15} /> Start patrol</button> : null}
          {mine ? <button type="button" className="btn btn-primary" onClick={() => { setNotes(""); setError(null); setFinishing(mine); }}><Check size={15} /> Finish my patrol</button> : null}
        </div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Footprints} label="On patrol now" value={active.length} ctx={active[0] ? `${active[0].officer_name} · ${active[0].route}` : "nobody"} />
        <Kpi icon={CalendarDays} label="Patrols today" value={today.length} ctx={`${pl(today.filter((p) => p.status === "Completed").length, "finished", "finished")}`} />
        <Kpi icon={Clock} label="Average length" value={avg ? fmtDur(avg) : "—"} ctx="finished patrols, last 7 days" />
        <Kpi icon={Route} label="Routes walked" value={new Set(week.map((p) => p.route)).size} ctx="different routes, last 7 days" />
      </div>

      <section className="card">
        <div className="card-h"><h3>On patrol now</h3><span className="sp" />{active.length ? <Badge tone="info">{pl(active.length, "patrol")}</Badge> : null}</div>
        {error && !starting && !finishing && !voiding ? <div className="err-note" role="alert" style={{ margin: "12px 20px 0" }}>{error}</div> : null}
        <ul className="list">
          {active.map((p) => (
            <li key={p.id} className="row">
              <span className="stripe s-info" />
              <div className="m"><b>{p.route}</b><span>{p.officer_name}{p.officer_id === meId ? " (you)" : ""} · started {day(p.started_at, now)} {hm(p.started_at)} · {fmtDur(mins(p.started_at))} so far</span></div>
              {canEdit && (p.officer_id === meId || canFinishAny) ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setNotes(""); setError(null); setFinishing(p); }}><Check size={14} /> Finish</button> : null}
              {canVoid ? <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Void ${p.route}`} title="Void" onClick={() => { setReason(""); setError(null); setVoiding(p); }}><Ban size={13} /></button> : null}
            </li>
          ))}
          {active.length === 0 ? <li className="empty">Nobody is on patrol right now.</li> : null}
        </ul>
      </section>

      <section className="card">
        <div className="card-h"><h3>Finished patrols</h3><span className="sp" /><span className="sub">newest first</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Day</th><th>Route</th><th>Officer</th><th>Started</th><th>Finished</th><th>Length</th><th>Notes</th>{canVoid ? <th /> : null}</tr></thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id} style={p.void ? { opacity: 0.55 } : undefined}>
                  <td>{day(p.started_at, now)}</td>
                  <td>{p.route}</td>
                  <td>{p.officer_name}</td>
                  <td className="mono">{hm(p.started_at)}</td>
                  <td className="mono">{p.ended_at ? hm(p.ended_at) : "—"}</td>
                  <td className="mono">{p.ended_at ? fmtDur(mins(p.started_at, p.ended_at)) : "—"}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 220 }}>{p.void ? <span className="muted">Voided{p.voided_by_name ? ` by ${p.voided_by_name}` : ""}: {p.void_reason}</span> : p.notes ?? <span className="muted">No notes</span>}</td>
                  {canVoid ? <td className="r">{!p.void ? <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Void ${p.route}`} title="Void" onClick={() => { setReason(""); setError(null); setVoiding(p); }}><Ban size={13} /></button> : null}</td> : null}
                </tr>
              ))}
              {history.length === 0 ? <tr><td colSpan={canVoid ? 8 : 7} className="empty">No patrols finished yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <Drawer
        open={starting}
        onClose={() => setStarting(false)}
        over="Patrols"
        title="Start a patrol"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setStarting(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending || !route.trim()} onClick={() => run(async () => { await callAction(startPatrolAction)(route); setStarting(false); })}><Play size={15} /> {pending ? "Starting…" : "Start patrol"}</button></>}
      >
        <div className="field">
          <label htmlFor="pt-route">Route</label>
          <input className="input" id="pt-route" list="pt-routes" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="e.g. Route B, Perimeter, Car park and pool" autoComplete="off" autoFocus />
          <datalist id="pt-routes">{routes.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <span className="hint">It’s timed from now and signed to you. Finish it with notes when you’re back.</span>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={!!finishing}
        onClose={() => setFinishing(null)}
        over="Patrols"
        title={finishing ? `Finish: ${finishing.route}` : ""}
        sub={finishing ? `${finishing.officer_name} · started ${hm(finishing.started_at)} · ${fmtDur(mins(finishing.started_at))}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setFinishing(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={() => finishing && run(async () => { await callAction(finishPatrolAction)(finishing.id, notes); setFinishing(null); })}><Check size={15} /> {pending ? "Saving…" : "Finish patrol"}</button></>}
      >
        <div className="field"><label htmlFor="pt-notes">What you found <span className="muted">(optional)</span></label><textarea className="input" id="pt-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. All clear. Storage door in Block C found unlocked, locked it and logged an incident." autoFocus /></div>
        <span className="hint">Anything that needs follow-up should also be logged as an incident.</span>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={!!voiding}
        onClose={() => setVoiding(null)}
        over="Patrols"
        title={voiding ? `Void: ${voiding.route}` : ""}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoiding(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!reason.trim() || pending} onClick={() => voiding && run(async () => { await callAction(voidPatrolAction)(voiding.id, reason); setVoiding(null); })}>{pending ? "Voiding…" : "Void patrol"}</button></>}
      >
        <p className="muted" style={{ margin: 0 }}>For mistakes and duplicates. The patrol stays on record, marked voided with your reason.</p>
        <div className="field"><label htmlFor="pt-reason">Reason (required)</label><textarea className="input" id="pt-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>
    </>
  );
}
