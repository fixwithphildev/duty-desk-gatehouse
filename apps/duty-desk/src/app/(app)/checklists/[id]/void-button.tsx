"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { voidChecklistAction } from "../actions";

export function VoidChecklistButton({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  const submit = () => {
    if (!reason.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await voidChecklistAction(id, reason);
        setOpen(false);
        setReason("");
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Ban size={13} /> Void this checklist
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Void this checklist">
        {error ? <div className="login-error">{error}</div> : null}
        <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 0 }}>
          This keeps the original submission and every item fully visible for the record — it won&apos;t be edited or deleted, just marked
          voided with your reason attached. If this was the apartment&apos;s current Ready/Not Ready record, the next most recent submitted
          checklist for it becomes authoritative again.
        </p>
        <Field label="Reason (required)">
          <textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Submitted against the wrong apartment" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!reason.trim() || pending} onClick={submit}>
          {pending ? "Voiding…" : "Void checklist"}
        </button>
      </Drawer>
    </>
  );
}
