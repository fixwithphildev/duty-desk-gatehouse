"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Plus, Repeat2, Undo2 } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/suite";
import { byDue, type TaskState } from "@/lib/tasks";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import type { TaskRow } from "@/lib/data/tasks";
import { createTaskAction, markTaskDoneAction, markTaskNotDoneAction, voidTaskAction } from "./actions";

export interface TaskView extends TaskRow {
  state: TaskState;
  addedDay: string;
  doneTime: string | null;
  doneDay: string | null;
}

const EMPTY = { description: "", assignedTo: "", dueTime: "" };

// "Someone else" in the Assign to list: type a name instead.
const OTHER = "__other__";

export function TasksClient({
  tasks, officers, teams, others, canEdit, canTick, canVoid, me,
}: { tasks: TaskView[]; officers: string[]; teams: string[]; others: string[]; canEdit: boolean; canTick: boolean; canVoid: boolean; me: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [voiding, setVoiding] = useState<TaskView | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [pending, startTransition] = useTransition();

  const overdue = tasks.filter((t) => t.state === "overdue").sort(byDue);
  const todo = tasks.filter((t) => t.state === "todo").sort(byDue);
  const done = tasks.filter((t) => t.state === "done").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const earlier = tasks.filter((t) => t.state === "earlier");
  const openTasks = [...overdue, ...todo];

  const who = new Map<string, number>();
  for (const t of openTasks) who.set(t.assigned_to || "Anyone on duty", (who.get(t.assigned_to || "Anyone on duty") ?? 0) + 1);
  const whoList = [...who.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...who.values());

  const run = (id: string, fn: () => Promise<void>) => {
    setActError(null);
    setBusy(id);
    startTransition(async () => {
      try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setActError(errorMessage(e)); } finally { setBusy(null); }
    });
  };

  const submit = () => {
    if (!form.description.trim()) return setError("Say what needs doing.");
    if (!form.assignedTo.trim()) return setError("Choose who does it.");
    setError(null);
    startTransition(async () => {
      try {
        await callAction(createTaskAction)(form);
        setForm(EMPTY);
        setOpen(false);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const row = (t: TaskView) => {
    const isDone = t.status === "Done";
    return (
      <li key={t.id} className="row">
        <span className="mono" style={{ fontSize: 12, width: 44, flex: "none", color: t.state === "overdue" ? "var(--bad-fg)" : "var(--text-3)" }}>{t.due_time || "—"}</span>
        <div className="m">
          <b style={isDone ? { textDecoration: "line-through", color: "var(--text-3)" } : undefined}>{t.description}</b>
          <span>
            {t.assigned_to || "Anyone on duty"}{t.assigned_to === me ? " (you)" : ""}
            {isDone ? ` · done${t.done_by_name ? ` by ${t.done_by_name}` : ""}${t.doneTime ? ` at ${t.doneTime}` : ""}${t.state === "earlier" && t.doneDay ? `, ${t.doneDay}` : ""}`
              : `${t.created_by_name ? ` · added by ${t.created_by_name}` : ""}${t.state === "overdue" && !t.due_time ? `, ${t.addedDay}` : ""}`}
          </span>
        </div>
        {isDone ? (
          <>
            {t.state === "done" ? <Badge tone="ok" dot={false}>Done</Badge> : null}
            {canTick && t.state === "done" ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(t.id, () => callAction(markTaskNotDoneAction)(t.id))}><Undo2 size={13} /> Undo</button> : null}
          </>
        ) : (
          <>
            {t.state === "overdue" ? <Badge tone="bad">Overdue</Badge> : null}
            {canTick ? <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(t.id, () => callAction(markTaskDoneAction)(t.id))}><Check size={13} /> {busy === t.id ? "Saving…" : "Done"}</button> : null}
          </>
        )}
        {canVoid ? <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Void task: ${t.description}`} title="Void" onClick={() => { setVoidReason(""); setVoiding(t); }}><Ban size={13} /></button> : null}
      </li>
    );
  };

  const group = (title: string, rows: TaskView[], empty: string) => (
    <div className="todo-sec">
      <span className="over">{title} · {rows.length}</span>
      <ul className="list">{rows.length ? rows.map(row) : <li className="empty">{empty}</li>}</ul>
    </div>
  );

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Tasks</h1><p>Small jobs for this shift. Give each one a person and a time; overdue jobs turn red.</p></div>
        <div className="acts">
          <AutoRefresh />
          {canEdit ? <button type="button" className="btn btn-primary" onClick={() => { setForm(EMPTY); setTyping(false); setError(null); setOpen(true); }}><Plus size={15} /> New task</button> : null}
        </div>
      </div>

      <div className="g g-main">
        <section className="card">
          <div className="card-h">
            <h3>Today</h3><span className="sp" />
            {overdue.length ? <Badge tone="bad">{overdue.length} overdue</Badge> : null}
            <Badge tone="neu" dot={false}>{openTasks.length} to do</Badge>
          </div>
          {actError ? <div className="err-note" role="alert" style={{ margin: "12px 16px 0" }}>{actError}</div> : null}
          {group("Overdue", overdue, "Nothing overdue.")}
          {group("To do", todo, "Nothing left to do.")}
          {group("Done today", done, "Nothing done yet today.")}
          {earlier.length ? (
            <div className="todo-sec">
              <button type="button" className="link" onClick={() => setShowEarlier((v) => !v)}>{showEarlier ? "Hide" : "Show"} {earlier.length} task{earlier.length > 1 ? "s" : ""} done on earlier days</button>
              {showEarlier ? <ul className="list">{earlier.slice(0, 50).map(row)}</ul> : null}
            </div>
          ) : null}
          <div style={{ height: 12 }} />
        </section>

        <div className="vstack" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-h"><h3>Who has what</h3><span className="sp" /><span className="sub">open tasks</span></div>
            <div className="card-b">
              {whoList.length ? whoList.map(([w, c]) => (
                <div key={w} className="hbar">
                  <span>{w}</span>
                  <span className="tr"><span style={{ width: `${(c / max) * 100}%`, background: "var(--acc)" }} /></span>
                  <span className="mono" style={{ textAlign: "right" }}>{c} task{c > 1 ? "s" : ""}</span>
                </div>
              )) : <p className="muted" style={{ margin: 0 }}>No open tasks.</p>}
            </div>
          </section>
          <div className="pill-note t-info"><Repeat2 size={16} /><span>Anything not done by the end of your shift goes in your handover note on the Duty log.</span></div>
        </div>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Tasks"
        title="New task"
        sub={`Added by ${me}`}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Plus size={15} /> {pending ? "Adding…" : "Add task"}</button></>}
      >
        <Field label="What needs doing"><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Deliver extra towels to Lisbon" /></Field>
        <div className="hstack" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="tk-who">Assign to</label>
            <select
              className="input"
              id="tk-who"
              value={typing ? OTHER : form.assignedTo}
              onChange={(e) => {
                if (e.target.value === OTHER) { setTyping(true); setForm({ ...form, assignedTo: "" }); }
                else { setTyping(false); setForm({ ...form, assignedTo: e.target.value }); }
              }}
            >
              <option value="" disabled>Choose who does it</option>
              {officers.length ? <optgroup label="Resident Officers">{officers.map((n) => <option key={n} value={n}>{n}{n === me ? " (you)" : ""}</option>)}</optgroup> : null}
              <optgroup label="Teams">{teams.map((t) => <option key={t} value={t}>{t === "Resident Officers" ? "Any Resident Officer on duty" : t}</option>)}</optgroup>
              {others.length ? <optgroup label="Other staff">{others.map((n) => <option key={n} value={n}>{n}{n === me ? " (you)" : ""}</option>)}</optgroup> : null}
              <option value={OTHER}>Someone else (type a name)</option>
            </select>
            {typing ? <input className="input" style={{ marginTop: 6 }} value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Their name" aria-label="Name of the person" autoFocus /> : null}
          </div>
          <div className="field" style={{ width: 130 }}>
            <label htmlFor="tk-due">Due <span className="muted">(optional)</span></label>
            <input className="input mono" id="tk-due" type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />
          </div>
        </div>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={!!voiding}
        onClose={() => setVoiding(null)}
        over="Tasks"
        title="Void this task"
        sub={voiding?.description}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoiding(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!voidReason.trim() || pending} onClick={() => voiding && run(voiding.id, async () => { await callAction(voidTaskAction)(voiding.id, voidReason); setVoiding(null); })}>{pending ? "Voiding…" : "Void task"}</button></>}
      >
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>The task is kept for the record, marked voided with your reason, and drops off the list.</p>
        <Field label="Reason (required)"><textarea className="input" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Added twice" /></Field>
        {actError ? <div className="err-note" role="alert">{actError}</div> : null}
      </Drawer>
    </>
  );
}
