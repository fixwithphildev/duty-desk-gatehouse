"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { emailReportAction } from "./actions";
import type { ReportDataset } from "@/lib/reports/exports";

export function EmailReportButton({ dataset, label }: { dataset: ReportDataset; label: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = () => {
    if (!email.trim()) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await emailReportAction(dataset, email);
        setSuccess(true);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Mail size={13} /> Email
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title={`Email ${label} report`}>
        {error ? <div className="login-error">{error}</div> : null}
        {success ? <div className="login-success">Sent — check that inbox shortly.</div> : null}
        <Field label="Send to email address">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!email.trim() || pending} onClick={submit}>
          {pending ? "Sending…" : "Send"}
        </button>
      </Drawer>
    </>
  );
}
