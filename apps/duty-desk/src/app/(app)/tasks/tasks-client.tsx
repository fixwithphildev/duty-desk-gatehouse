"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createTaskAction, markTaskDoneAction } from "./actions";
import type { TaskRow } from "@/lib/data/tasks";

const EMPTY = { description: "", assignedTo: "", dueTime: "" };

export function TasksClient({ tasks, canEdit }: { tasks: TaskRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!form.description.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createTaskAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const markDone = (id: string) => startTransition(async () => { await markTaskDoneAction(id); });

  return (
    <div className="view">
      <div className="view-head">
        <h2>Tasks</h2>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> New task
          </button>
        ) : null}
      </div>

      <ul className="feed feed-card">
        {tasks.map((t) => (
          <li key={t.id} className="feed-row feed-row-block">
            <span className={`feed-dot ${t.status === "Done" ? "tone-teal" : "tone-gold"}`} />
            <div className="feed-main">
              <div className="feed-label">{t.description}</div>
              <div className="feed-meta mono">{t.assigned_to || "Unassigned"} {t.due_time ? `· due ${t.due_time}` : ""}</div>
            </div>
            {t.status === "Pending" ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => markDone(t.id)}>
                <CheckCircle2 size={13} /> Done
              </button>
            ) : (
              <Badge tone="teal">Done</Badge>
            )}
          </li>
        ))}
        {tasks.length === 0 ? <li style={{ padding: 16, opacity: 0.75, fontSize: 13 }}>No tasks yet.</li> : null}
      </ul>

      <Drawer open={open} onClose={() => setOpen(false)} title="New task">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Description"><textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Assigned to"><input className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="e.g. Housekeeping" /></Field>
        <Field label="Due"><input className="input" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} placeholder="e.g. 3:00 PM or Today" /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.description.trim() || pending} onClick={submit}>
          {pending ? "Adding…" : "Add task"}
        </button>
      </Drawer>
    </div>
  );
}
