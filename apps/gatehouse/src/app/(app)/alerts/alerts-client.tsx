"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, BellRing, CalendarDays, Check, Hourglass, OctagonAlert } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Drawer } from "@/components/drawer";
import { RaiseAlert } from "@/components/raise-alert";
import { Badge, Kpi, type Tone } from "@/components/suite";
import type { Alert } from "@/lib/data/alerts";
import { sevTone } from "@/lib/types";
import { fmtDur } from "@/lib/gate";
import { errorMessage, isRedirectError } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { acknowledgeAlertAction, resolveAlertAction, voidAlertAction } from "./actions";

type Tab = "open" | "resolved" | "all";
const TZ = "Africa/Lagos";
const dayKey = (t: number | string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const when = (iso: string, now: number) => {
  const t = new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (dayKey(iso) === dayKey(now)) return `Today ${t}`;
  if (dayKey(iso) === dayKey(now - 86400_000)) return `Yesterday ${t}`;
  return `${new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })}, ${t}`;
};
const STATUS: Record<Alert["status"], [string, Tone]> = { Unacknowledged: ["Not acknowledged", "bad"], Acknowledged: ["Waiting for the all-clear", "warn"], Resolved: ["Resolved", "ok"] };
const gap = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));

export function AlertsClient({ alerts, now, initialId, canEdit, canVoid }: { alerts: Alert[]; now: number; initialId: string | null; canEdit: boolean; canVoid: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("open");
  const [openId, setOpenId] = useState<string | null>(initialId);
  const [step, setStep] = useState<null | "resolve" | "void">(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const a = alerts.find((x) => x.id === initialId); if (a && (a.status === "Resolved" || a.void)) setTab("all"); }, [initialId, alerts]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("id", openId); else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
    setStep(null); setNotes(""); setError(null);
  }, [openId]);

  const run = (fn: () => Promise<void>) =>
    start(async () => { try { setError(null); await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); } });

  const live = alerts.filter((a) => !a.void);
  const unack = live.filter((a) => a.status === "Unacknowledged");
  const waiting = live.filter((a) => a.status === "Acknowledged");
  const month = live.filter((a) => now - new Date(a.created_at).getTime() < 30 * 86400_000);
  const acked = month.filter((a) => a.acknowledged_at);
  const avgAck = acked.length ? Math.round(acked.reduce((s, a) => s + gap(a.created_at, a.acknowledged_at!), 0) / acked.length) : 0;

  const inTab = (a: Alert, t: Tab) => (t === "all" ? true : t === "open" ? !a.void && a.status !== "Resolved" : !a.void && a.status === "Resolved");
  const list = alerts.filter((a) => inTab(a, tab)).sort((a, b) => (tab === "open" ? (a.status === "Unacknowledged" ? 0 : 1) - (b.status === "Unacknowledged" ? 0 : 1) || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at)));
  const sel = alerts.find((a) => a.id === openId) ?? null;

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Alerts</h1><p>Property-wide alerts: fire, medical emergency, security breach, lockdown. An alert shows on every Gatehouse screen until someone acknowledges it, and stays there until it’s resolved with notes.</p></div>
        <div className="acts"><AutoRefresh />{canEdit ? <RaiseAlert /> : null}</div>
      </div>

      <div className="kpis k4">
        <Kpi icon={BellRing} label="Not acknowledged" value={unack.length} ctx={unack[0] ? `${unack[0].type} · ${when(unack[0].created_at, now)}` : "none"} tile={unack.length ? "bad" : ""} />
        <Kpi icon={Hourglass} label="Waiting for the all-clear" value={waiting.length} ctx={waiting[0] ? `${waiting[0].type}${waiting[0].location ? ` · ${waiting[0].location}` : ""}` : "none"} tile={waiting.length ? "warn" : ""} />
        <Kpi icon={CalendarDays} label="Raised in the last 30 days" value={month.length} ctx={`${month.filter((a) => a.severity === "Critical").length} critical`} />
        <Kpi icon={Check} label="Time to acknowledge" value={avgAck ? fmtDur(avgAck) : "—"} ctx="average, last 30 days" />
      </div>

      <section className="card">
        <div className="tabs" role="tablist">
          {([["open", "Open"], ["resolved", "Resolved"], ["all", "All"]] as [Tab, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{alerts.filter((a) => inTab(a, k)).length}</span></button>)}
        </div>
        <ul className="list">
          {list.map((a) => {
            const [label, tone] = a.void ? ["Voided", "neu" as Tone] : STATUS[a.status];
            return (
              <li key={a.id}>
                <button type="button" className="row click" onClick={() => setOpenId(a.id)} style={{ width: "100%", textAlign: "left", background: openId === a.id ? "var(--acc-bg)" : "transparent", border: 0, color: "inherit", ...(a.void ? { opacity: 0.55 } : {}) }}>
                  <span className={`stripe s-${a.void ? "neu" : tone}`} />
                  <div className="m">
                    <b>{a.type}{a.location ? ` · ${a.location}` : ""}</b>
                    <span>{a.message}</span>
                    <span style={{ display: "block" }}>Raised {when(a.created_at, now)} by {a.raised_by_name}{a.acknowledged_at ? ` · acknowledged by ${a.acknowledged_by_name ?? "—"} after ${fmtDur(gap(a.created_at, a.acknowledged_at))}` : ""}{a.resolved_at ? ` · resolved by ${a.resolved_by_name ?? "—"}` : ""}</span>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                  <Badge tone={sevTone(a.severity)} dot={false}>{a.severity}</Badge>
                </button>
              </li>
            );
          })}
          {list.length === 0 ? <li className="empty">{tab === "open" ? "No open alerts. All clear." : "No alerts yet."}</li> : null}
        </ul>
      </section>

      <Drawer
        open={!!sel}
        onClose={() => setOpenId(null)}
        over={sel ? `Alert · ${sel.severity}` : ""}
        title={sel ? `${sel.type}${sel.location ? ` · ${sel.location}` : ""}` : ""}
        sub={sel ? <span className="hstack">{sel.void ? <Badge tone="neu" dot={false}>Voided</Badge> : <Badge tone={STATUS[sel.status][1]}>{STATUS[sel.status][0]}</Badge>}</span> : undefined}
        footer={sel && !sel.void ? (
          <>
            {canVoid ? <button type="button" className="btn btn-ghost" onClick={() => { setNotes(""); setStep("void"); }}><Ban size={15} /> Void</button> : null}
            <span style={{ flex: 1 }} />
            {canEdit && sel.status === "Unacknowledged" && !step ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => callAction(acknowledgeAlertAction)(sel.id))}><Check size={15} /> Acknowledge</button> : null}
            {canEdit && sel.status !== "Resolved" && !step ? <button type="button" className="btn btn-secondary" onClick={() => { setNotes(""); setStep("resolve"); }}>Resolve with notes</button> : null}
            {step === "resolve" ? <><button type="button" className="btn btn-ghost" onClick={() => setStep(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending || !notes.trim()} onClick={() => run(async () => { await callAction(resolveAlertAction)(sel.id, notes); setStep(null); })}><Check size={15} /> {pending ? "Saving…" : "Resolve"}</button></> : null}
            {step === "void" ? <><button type="button" className="btn btn-ghost" onClick={() => setStep(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={pending || !notes.trim()} onClick={() => run(async () => { await callAction(voidAlertAction)(sel.id, notes); setStep(null); })}>{pending ? "Voiding…" : "Void alert"}</button></> : null}
          </>
        ) : undefined}
      >
        {sel ? (
          <>
            {step === "resolve" ? (
              <div className="work-box">
                <span className="over">Resolve</span>
                <div className="field"><label htmlFor="al-res">What happened and the all-clear</label><textarea className="input" id="al-res" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. False alarm, smoke from the generator. Fire team checked, all clear at 22:20." autoFocus /></div>
              </div>
            ) : null}
            {step === "void" ? (
              <div className="work-box">
                <span className="over">Void this alert</span>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>Only for an alert raised by mistake. It stays on record, marked voided with your reason.</p>
                <div className="field"><label htmlFor="al-void">Reason (required)</label><textarea className="input" id="al-void" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} autoFocus /></div>
              </div>
            ) : null}
            {error ? <div className="err-note" role="alert">{error}</div> : null}
            <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap" }}>{sel.message}</p>
            <ul className="tl" style={{ padding: 0 }}>
              <li><span className="tm">{when(sel.created_at, now).replace(/^Today /, "")}</span><span className="dt"><OctagonAlert size={11} /></span><span className="tx"><b>{sel.raised_by_name}</b> raised it</span></li>
              {sel.acknowledged_at ? <li><span className="tm">{when(sel.acknowledged_at, now).replace(/^Today /, "")}</span><span className="dt"><Check size={11} /></span><span className="tx"><b>{sel.acknowledged_by_name ?? "Someone"}</b> acknowledged it after {fmtDur(gap(sel.created_at, sel.acknowledged_at))}</span></li> : null}
              {sel.resolved_at ? <li><span className="tm">{when(sel.resolved_at, now).replace(/^Today /, "")}</span><span className="dt"><Check size={11} /></span><span className="tx"><b>{sel.resolved_by_name ?? "Someone"}</b> resolved it: {sel.resolution_notes}</span></li> : null}
              {sel.void ? <li><span className="tm">—</span><span className="dt"><Ban size={11} /></span><span className="tx"><b>{sel.voided_by_name ?? "Someone"}</b> voided it: {sel.void_reason}</span></li> : null}
            </ul>
            {!canEdit ? <span className="hint">View only. Officers, the Supervisor and the Admin acknowledge and resolve alerts.</span> : null}
          </>
        ) : null}
      </Drawer>
    </>
  );
}
