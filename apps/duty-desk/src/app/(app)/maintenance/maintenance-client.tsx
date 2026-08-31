"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Paperclip, Ban } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { DD_PRIORITIES, DD_TICKET_DEPTS, DD_TICKET_STATUSES, priorityTone } from "@/lib/checklist-data";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createTicketAction, updateTicketStatusAction, voidTicketAction } from "./actions";
import type { MaintenanceTicketRow } from "@/lib/data/maintenance";

const REFRESH_MS = 5_000;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MaintenanceClient({ tickets, canEdit, canVoid }: { tickets: MaintenanceTicketRow[]; canEdit: boolean; canVoid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [voidTarget, setVoidTarget] = useState<MaintenanceTicketRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

  // This table is the one genuinely shared record with Maintenance Desk —
  // a status change made over there writes straight to the same row, but
  // there's no way for that separate app to tell this already-open page to
  // re-fetch. Poll on the same interval as the notification toasts so
  // changes from either side show up without a manual refresh.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [router]);

  const submit = () => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    if (!String(formData.get("area") ?? "").trim() || !String(formData.get("issueType") ?? "").trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createTicketAction(formData);
        formRef.current?.reset();
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const onStatusChange = (id: string, status: "Reported" | "In Progress" | "Resolved") => {
    startTransition(async () => {
      await updateTicketStatusAction(id, status);
    });
  };

  const submitVoid = () => {
    if (!voidTarget || !voidReason.trim()) return;
    setVoidError(null);
    startTransition(async () => {
      try {
        await voidTicketAction(voidTarget.id, voidReason);
        setVoidTarget(null);
        setVoidReason("");
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setVoidError(errorMessage(e));
      }
    });
  };

  return (
    <div className="view">
      <div className="view-head">
        <h2>Maintenance Tickets</h2>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> New ticket
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Reported</th><th>Area</th><th>Issue</th><th>Assigned</th><th>Priority</th><th>Source</th><th>Logged by</th><th>Status</th></tr></thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} style={t.void ? { opacity: 0.6 } : undefined}>
                <td className="mono" data-label="Reported">{fmtTime(t.created_at)}</td>
                <td data-label="Area">{t.area}</td>
                <td data-label="Issue">
                  <div className="cell-title">
                    {t.issue_type} {t.photo_count > 0 ? <Paperclip size={12} style={{ verticalAlign: "middle", opacity: 0.6 }} /> : null}
                  </div>
                  {t.notes ? <div className="cell-sub">{t.notes}</div> : null}
                  {t.void ? (
                    <div className="cell-sub" style={{ color: "var(--red)" }}>Voided by {t.voided_by_name} — {t.void_reason}</div>
                  ) : canVoid ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { setVoidTarget(t); setVoidReason(""); setVoidError(null); }}>
                      <Ban size={12} /> Void
                    </button>
                  ) : null}
                </td>
                <td data-label="Assigned">{t.assigned_to}</td>
                <td data-label="Priority"><Badge tone={priorityTone(t.priority)}>{t.priority}</Badge></td>
                <td data-label="Source"><Badge tone={t.source === "checklist" ? "gold" : "neutral"}>{t.source === "checklist" ? "Checklist" : "Manual"}</Badge></td>
                <td className="cell-sub" data-label="Logged by">{t.logged_by_name ?? "—"}</td>
                <td data-label="Status">
                  {t.void ? (
                    <Badge tone="neutral">Voided</Badge>
                  ) : canEdit ? (
                    <select className="select select-sm" value={t.status} disabled={pending} onChange={(e) => onStatusChange(t.id, e.target.value as typeof t.status)}>
                      {DD_TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge tone={t.status === "Resolved" ? "teal" : "gold"}>{t.status}</Badge>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", opacity: 0.75 }}>No maintenance tickets.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="New maintenance ticket">
        {error ? <div className="login-error">{error}</div> : null}
        <form ref={formRef}>
          <Field label="Area / room"><input className="input" name="area" placeholder="e.g. Apartment 12B" /></Field>
          <Field label="Issue"><input className="input" name="issueType" placeholder="e.g. Leaking tap" /></Field>
          <Field label="Assign to">
            <select className="select" name="assignedTo" defaultValue={DD_TICKET_DEPTS[0]}>
              {DD_TICKET_DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="select" name="priority" defaultValue="Medium">
              {DD_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Photo (optional)">
            <input className="input" name="photo" type="file" accept="image/*" />
          </Field>
        </form>
        <button type="button" className="btn btn-primary drawer-submit" disabled={pending} onClick={submit}>
          {pending ? "Creating…" : "Create ticket"}
        </button>
      </Drawer>

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this ticket">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 0 }}>This keeps the original ticket visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
        {voidTarget ? <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>{voidTarget.issue_type} — {voidTarget.area}</p> : null}
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Duplicate ticket, already logged" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!voidReason.trim() || pending} onClick={submitVoid}>
          {pending ? "Voiding…" : "Void ticket"}
        </button>
      </Drawer>
    </div>
  );
}
