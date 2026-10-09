"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { emailReportAction } from "./actions";
import type { ReportDataset } from "@/lib/reports/exports";

// Sends one record set as a CSV attachment.
export function EmailReportButton({ dataset, label }: { dataset: ReportDataset; label: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = () => {
    setError(null);
    setSent(false);
    startTransition(async () => {
      try {
        await callAction(emailReportAction)(dataset, email);
        setSent(true);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSent(false); setError(null); setOpen(true); }} aria-label={`Email the ${label.toLowerCase()}`}><Mail size={14} /> Email</button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Reports"
        title={`Email the ${label.toLowerCase()}`}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Close</button><button type="button" className="btn btn-primary" disabled={!email.trim() || pending} onClick={submit}><Mail size={15} /> {pending ? "Sending…" : "Send"}</button></>}
      >
        <div className="field"><label htmlFor="rep-email">Send to</label><input className="input" id="rep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus /></div>
        <span className="hint">The full record goes as a spreadsheet (CSV) attachment that opens in Excel or Google Sheets.</span>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
        {sent ? <div className="ok-note" role="status">Sent. It should arrive shortly.</div> : null}
      </Drawer>
    </>
  );
}
