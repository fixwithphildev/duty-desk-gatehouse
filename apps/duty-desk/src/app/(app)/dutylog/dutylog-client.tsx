"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, CheckCheck, Lock, Plus, Repeat2, Sparkles } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/suite";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import type { DutyLogRow } from "@/lib/data/dutylog";
import { acknowledgeHandoverAction, addDutyLogEntryAction, voidDutyLogEntryAction } from "./actions";

export interface LogView extends DutyLogRow {
  day: string;
  dayLabel: string;
  time: string;
  shift: string;
  ackWhen: string | null;
  mine: boolean;
}

const PAGE = 60;

export function DutyLogClient({ entries, draft, shiftNow, canEdit, canVoid }: { entries: LogView[]; draft: string; shiftNow: string; canEdit: boolean; canVoid: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "handover">("all");
  const [notes, setNotes] = useState("");
  const [handover, setHandover] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<LogView | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [pending, startTransition] = useTransition();

  // Handover notes from someone else that nobody has acknowledged yet, newest first.
  const waiting = entries.filter((e) => e.handover && !e.acknowledged_at && !e.void && !e.mine);
  const list = entries.filter((e) => filter === "all" || e.handover);
  const page = list.slice(0, shown);
  const days = [...new Set(page.map((e) => e.day))];

  const run = (fn: () => Promise<void>) => {
    setActError(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setActError(errorMessage(e)); }
    });
  };

  const add = () => {
    if (!notes.trim()) return setError("Write what happened first.");
    setError(null);
    startTransition(async () => {
      try {
        await callAction(addDutyLogEntryAction)({ notes, handover });
        setNotes("");
        setHandover(false);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const useDraft = () => {
    setNotes((n) => (n.trim() ? `${n.trim()}\n\n${draft}` : draft));
    setHandover(true);
  };

  const entry = (e: LogView) => (
    <div key={e.id} className={`dl-entry ${e.handover && !e.void ? "ho" : ""}`} style={e.void ? { opacity: 0.6 } : undefined}>
      <span className="tm">{e.time}</span>
      <div style={{ minWidth: 0 }}>
        <div className="hstack" style={{ gap: 8 }}>
          <b>{e.officer_name}</b>
          <span className="muted" style={{ fontSize: 12.5 }}>{e.shift}</span>
          {e.void ? <Badge tone="neu" dot={false}>Voided</Badge> : e.handover ? <Badge tone="warn">Handover note</Badge> : null}
          <span className="sp" style={{ flex: 1 }} />
          {canVoid && !e.void ? <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Void this entry" title="Void" onClick={() => { setVoidReason(""); setVoiding(e); }}><Ban size={13} /></button> : null}
        </div>
        <p style={{ margin: "6px 0 0", whiteSpace: "pre-line", textDecoration: e.void ? "line-through" : undefined }}>{e.notes}</p>
        {e.void ? <span className="hint">Voided by {e.voided_by_name ?? "a manager"}: {e.void_reason}</span>
          : e.handover ? (
            e.acknowledged_at ? <span className="hint"><CheckCheck size={13} style={{ verticalAlign: "-2px" }} /> Acknowledged by {e.acknowledged_by_name ?? "the next shift"} · {e.ackWhen}</span>
              : e.mine || !canEdit ? <span className="hint">Waiting for the next shift to acknowledge</span>
                : <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={pending} onClick={() => run(() => callAction(acknowledgeHandoverAction)(e.id))}><Check size={14} /> Acknowledge</button>
          ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Duty log</h1><p>What happened on each shift, in order. End your shift with a handover note; the next officer must acknowledge it.</p></div>
        <div className="acts"><AutoRefresh /></div>
      </div>

      {waiting[0] ? (
        <section className="handover" aria-label="Handover waiting">
          <div className="ic"><Repeat2 size={18} /></div>
          <div className="tx">
            <b>Handover from {waiting[0].officer_name} needs acknowledging</b>
            <p style={{ whiteSpace: "pre-line" }}>{waiting[0].notes}</p>
          </div>
          <div className="acts">{canEdit ? <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => callAction(acknowledgeHandoverAction)(waiting[0].id))}><Check size={14} /> Acknowledge</button> : <span className="hint">Waiting for the next shift</span>}</div>
        </section>
      ) : null}
      {actError ? <div className="err-note" role="alert" style={{ marginBottom: 14 }}>{actError}</div> : null}

      <div className="g g-main">
        <section className="card">
          <div className="card-h">
            <h3>Log</h3><span className="sp" />
            <div className="seg" role="group" aria-label="Show">
              {([["all", "All entries"], ["handover", "Handover notes"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
            </div>
          </div>
          {days.map((d) => {
            const es = page.filter((e) => e.day === d);
            return <div key={d}><div className="dl-day">{es[0].dayLabel}</div>{es.map(entry)}</div>;
          })}
          {list.length === 0 ? <div className="empty" style={{ padding: "24px 20px" }}>{filter === "handover" ? "No handover notes yet." : "Nothing logged yet."}</div> : null}
          {list.length > shown ? <div style={{ padding: "12px 20px" }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => setShown((n) => n + PAGE)}>Show older entries</button></div> : null}
        </section>

        <div className="vstack" style={{ gap: 18 }}>
          {canEdit ? (
            <section className="card">
              <div className="card-h"><h3>Add an entry</h3><span className="sp" /><span className="sub">{shiftNow}</span></div>
              <div className="card-b vstack" style={{ gap: 12 }}>
                <textarea className="input" rows={6} aria-label="Log entry" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened this shift" />
                <label className="chk"><input type="checkbox" checked={handover} onChange={(e) => setHandover(e.target.checked)} /> Mark as shift handover note</label>
                {error ? <div className="err-note" role="alert">{error}</div> : null}
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={useDraft}><Sparkles size={14} /> Draft my handover</button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={add}><Plus size={14} /> {pending ? "Saving…" : "Add entry"}</button>
                </div>
                <span className="hint">“Draft my handover” fills in what’s still open: apartments, complaints, tickets and tasks. Check it and add anything else before saving.</span>
              </div>
            </section>
          ) : null}
          <div className="pill-note" style={{ background: "var(--subtle)", border: "1px solid var(--line)" }}><Lock size={16} /><span>Entries can’t be edited once saved. A Supervisor, a manager or the Admin can void a wrong entry, with a reason.</span></div>
        </div>
      </div>

      <Drawer
        open={!!voiding}
        onClose={() => setVoiding(null)}
        over="Duty log"
        title="Void this entry"
        sub={voiding ? `${voiding.officer_name} · ${voiding.dayLabel} ${voiding.time}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoiding(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!voidReason.trim() || pending} onClick={() => voiding && run(async () => { await callAction(voidDutyLogEntryAction)(voiding.id, voidReason); setVoiding(null); })}>{pending ? "Voiding…" : "Void entry"}</button></>}
      >
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>The entry stays in the log for the record. It’s only marked voided, with your reason.</p>
        {voiding ? <p style={{ margin: 0, whiteSpace: "pre-line" }}>{voiding.notes}</p> : null}
        <Field label="Reason (required)"><textarea className="input" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Written in the wrong shift" /></Field>
        {actError ? <div className="err-note" role="alert">{actError}</div> : null}
      </Drawer>
    </>
  );
}
