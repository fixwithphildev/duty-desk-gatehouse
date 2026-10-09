"use client";

import { useState, useTransition } from "react";
import { Mail, Send } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { emailReportAction } from "./actions";
import type { ReportDataset } from "@/lib/reports/exports";

export function EmailReportButton({ dataset, label }: { dataset: ReportDataset; label: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = () => {
    if (!email.trim()) return setError("Give the email address to send it to.");
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await callAction(emailReportAction)(dataset, email);
        setSuccess(true);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSuccess(false); setError(null); setOpen(true); }}>
        <Mail size={14} /> Email
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Reports"
        title={`Email the ${label.toLowerCase()} list`}
        sub="Sent as a CSV attachment"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{success ? "Close" : "Cancel"}</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Send size={15} /> {pending ? "Sending…" : "Send"}</button></>}
      >
        <Field label="Send to email address"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" /></Field>
        {success ? <div className="pill-note t-ok">Sent. It should arrive in that inbox shortly.</div> : null}
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>
    </>
  );
}
