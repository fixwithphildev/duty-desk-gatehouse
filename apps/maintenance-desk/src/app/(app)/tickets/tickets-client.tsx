"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Paperclip } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { MD_PRIORITIES, MD_DEPARTMENTS, MD_TICKET_STATUSES, priorityTone, type TicketStatus } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createTicketAction, updateTicketStatusAction, getTicketPhotosAction } from "./actions";
import type { MaintenanceTicketRow } from "@/lib/data/tickets";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TicketsClient({ tickets, canEdit }: { tickets: MaintenanceTicketRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [photoView, setPhotoView] = useState<{ label: string; urls: string[] } | null>(null);
  const [photoLoading, setPhotoLoading] = useState<string | null>(null);

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

  const onStatusChange = (id: string, status: TicketStatus) => {
    startTransition(async () => {
      await updateTicketStatusAction(id, status);
    });
  };

  const viewPhotos = (ticket: MaintenanceTicketRow) => {
    setPhotoLoading(ticket.id);
    startTransition(async () => {
      const urls = await getTicketPhotosAction(ticket.id);
      setPhotoLoading(null);
      setPhotoView({ label: `${ticket.issue_type} — ${ticket.area}`, urls });
    });
  };

  return (
    <div className="view">
      <div className="view-head">
        <h2>Tickets</h2>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> New ticket
          </button>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Reported</th><th>Area</th><th>Issue</th><th>Department</th><th>Priority</th><th>Logged by</th><th>Status</th></tr></thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className="mono" data-label="Reported">{fmtTime(t.created_at)}</td>
                <td data-label="Area">{t.area}</td>
                <td data-label="Issue">
                  <div className="cell-title">{t.issue_type}</div>
                  {t.notes ? <div className="cell-sub">{t.notes}</div> : null}
                  {t.photo_count > 0 ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} disabled={photoLoading === t.id} onClick={() => viewPhotos(t)}>
                      <Paperclip size={12} /> {photoLoading === t.id ? "Loading…" : `Photos (${t.photo_count})`}
                    </button>
                  ) : null}
                </td>
                <td data-label="Department">{t.assigned_to}</td>
                <td data-label="Priority"><Badge tone={priorityTone(t.priority)}>{t.priority}</Badge></td>
                <td className="cell-sub" data-label="Logged by">{t.logged_by_name ?? "—"}{t.source === "checklist" ? " (checklist)" : ""}</td>
                <td data-label="Status">
                  {canEdit ? (
                    <select className="select select-sm" value={t.status} disabled={pending} onChange={(e) => onStatusChange(t.id, e.target.value as TicketStatus)}>
                      {MD_TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge tone={t.status === "Resolved" ? "green" : t.status === "In Progress" ? "blue" : "orange"}>{t.status}</Badge>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", opacity: 0.75 }}>No tickets right now.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="New maintenance ticket">
        {error ? <div className="login-error">{error}</div> : null}
        <form ref={formRef}>
          <Field label="Area / location"><input className="input" name="area" placeholder="e.g. Apartment 12B, Pool pump room" /></Field>
          <Field label="Issue"><input className="input" name="issueType" placeholder="e.g. Leaking tap" /></Field>
          <Field label="Department">
            <select className="select" name="assignedTo" defaultValue={MD_DEPARTMENTS[0]}>
              {MD_DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="select" name="priority" defaultValue="Medium">
              {MD_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
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

      <Drawer open={!!photoView} onClose={() => setPhotoView(null)} title={photoView?.label ?? "Photos"}>
        {photoView && photoView.urls.length === 0 ? <p className="gate-copy" style={{ marginTop: 0 }}>No photos on this ticket.</p> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {photoView?.urls.map((url) => (
            <img key={url} src={url} alt="Ticket photo" style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)" }} />
          ))}
        </div>
      </Drawer>
    </div>
  );
}
