"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { voidChecklistAction } from "../actions";

export function VoidChecklistButton({ id, apartment, canEdit }: { id: string; apartment: string; canEdit: boolean }) {
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
        await callAction(voidChecklistAction)(id, reason);
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
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Checklists"
        title="Void this checklist"
        sub={apartment}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={!reason.trim() || pending} onClick={submit}>{pending ? "Voiding…" : "Void checklist"}</button>
          </>
        }
      >
        {error ? <div className="err-note" role="alert">{error}</div> : null}
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          The original submission and every item stay visible for the record. It’s only marked voided, with your reason. If this was the
          apartment’s latest check-in prep, the one before it decides whether it can be sold.
        </p>
        <Field label="Reason (required)">
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Submitted against the wrong apartment" />
        </Field>
      </Drawer>
    </>
  );
}
