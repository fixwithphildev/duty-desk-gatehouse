"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Paperclip, Ban } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { MD_PRIORITIES, MD_DEPARTMENTS, MD_TICKET_STATUSES, priorityTone, formatNaira, type TicketStatus } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { createTicketAction, updateTicketStatusAction, voidTicketAction, getTicketPhotosAction } from "./actions";
import { CostsDrawer, type CostsMode } from "./costs-drawer";
import type { MaintenanceTicketRow } from "@/lib/data/tickets";
import type { TicketCostInfo } from "@/lib/data/expenses";

const REFRESH_MS = 5_000;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TicketsClient({
  tickets,
  costs,
  canEdit,
  canVoid,
}: {
  tickets: MaintenanceTicketRow[];
  costs: Record<string, TicketCostInfo>;
  canEdit: boolean;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [costsTarget, setCostsTarget] = useState<{ ticket: MaintenanceTicketRow; mode: CostsMode } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Same shared table, same problem in reverse — a status change made in
  // Duty Desk writes straight to this row, but this app has no way to know
  // unless it checks. Poll on the same interval as the notification toasts.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [router]);

  const [photoView, setPhotoView] = useState<{ label: string; urls: string[] } | null>(null);
  const [photoLoading, setPhotoLoading] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<MaintenanceTicketRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);

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

  const onStatusChange = (ticket: MaintenanceTicketRow, status: TicketStatus) => {
    // Resolving asks what was bought first — the status only changes once
    // that form is submitted, so cancelling leaves the ticket as it was.
    if (status === "Resolved") {
      setCostsTarget({ ticket, mode: "resolve" });
      return;
    }
    setStatusError(null);
    startTransition(async () => {
      try {
        await updateTicketStatusAction(ticket.id, status);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setStatusError(errorMessage(e));
      }
    });
  };

  const costCell = (t: MaintenanceTicketRow) => {
    const info = costs[t.id];
    if (info && info.lineCount > 0) {
      return (
        <button type="button" className="btn btn-ghost btn-sm mono" onClick={() => setCostsTarget({ ticket: t, mode: "view" })}>
          {formatNaira(info.total)}
        </button>
      );
    }
    if (info?.noPurchase) {
      return (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCostsTarget({ ticket: t, mode: "view" })}>
          No purchase
        </button>
      );
    }
    // Resolved with nothing recorded — e.g. resolved from Duty Desk, which
    // has no cost step. Flagged so it gets filled in.
    if (t.status === "Resolved" && !t.void) {
      return canEdit ? (
        <button type="button" className="btn btn-sm cost-missing" onClick={() => setCostsTarget({ ticket: t, mode: "view" })}>
          Add cost
        </button>
      ) : (
        <Badge tone="orange">Not recorded</Badge>
      );
    }
    return canEdit && !t.void ? (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCostsTarget({ ticket: t, mode: "view" })}>
        <Plus size={12} /> Cost
      </button>
    ) : (
      <span className="cell-sub">—</span>
    );
  };

  const viewPhotos = (ticket: MaintenanceTicketRow) => {
    setPhotoLoading(ticket.id);
    startTransition(async () => {
      const urls = await getTicketPhotosAction(ticket.id);
      setPhotoLoading(null);
      setPhotoView({ label: `${ticket.issue_type} — ${ticket.area}`, urls });
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
        <h2>Tickets</h2>
        {canEdit ? (
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> New ticket
          </button>
        ) : null}
      </div>

      {statusError ? <div className="login-error">{statusError}</div> : null}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Reported</th><th>Area</th><th>Issue</th><th>Department</th><th>Priority</th><th>Logged by</th><th>Status</th><th>Cost</th></tr></thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} style={t.void ? { opacity: 0.6 } : undefined}>
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
                  {t.void ? (
                    <div className="cell-sub" style={{ color: "var(--red)" }}>Voided by {t.voided_by_name} — {t.void_reason}</div>
                  ) : canVoid ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => { setVoidTarget(t); setVoidReason(""); setVoidError(null); }}>
                      <Ban size={12} /> Void
                    </button>
                  ) : null}
                </td>
                <td data-label="Department">{t.assigned_to}</td>
                <td data-label="Priority"><Badge tone={priorityTone(t.priority)}>{t.priority}</Badge></td>
                <td className="cell-sub" data-label="Logged by">{t.logged_by_name ?? "—"}{t.source === "checklist" ? " (checklist)" : ""}</td>
                <td data-label="Status">
                  {t.void ? (
                    <Badge tone="neutral">Voided</Badge>
                  ) : canEdit ? (
                    <select className="select select-sm" value={t.status} disabled={pending} onChange={(e) => onStatusChange(t, e.target.value as TicketStatus)}>
                      {MD_TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge tone={t.status === "Resolved" ? "green" : t.status === "In Progress" ? "blue" : "orange"}>{t.status}</Badge>
                  )}
                </td>
                <td data-label="Cost">{costCell(t)}</td>
              </tr>
            ))}
            {tickets.length === 0 ? (
              <tr><td colSpan={8}style={{ padding: 24, textAlign: "center", opacity: 0.75 }}>No tickets right now.</td></tr>
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

      <CostsDrawer
        ticket={costsTarget?.ticket ?? null}
        mode={costsTarget?.mode ?? "view"}
        canEdit={canEdit}
        canVoid={canVoid}
        onClose={() => setCostsTarget(null)}
      />

      <Drawer open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void this ticket">
        {voidError ? <div className="login-error">{voidError}</div> : null}
        <p className="gate-copy" style={{ marginTop: 0 }}>This keeps the original ticket visible for the record — it won&apos;t be edited or deleted, just marked voided with your reason attached.</p>
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
