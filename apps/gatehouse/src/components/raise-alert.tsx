"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, OctagonAlert } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { raiseAlertAction } from "@/app/(app)/alerts/actions";
import { GH_ALERT_TYPES, GH_PLACES } from "@/lib/constants";
import { GH_SEVERITIES } from "@/lib/types";
import { errorMessage, isRedirectError } from "@/lib/utils";
import { callAction } from "@/lib/action";

const EMPTY = { type: "Security Breach", severity: "High", location: "", message: "" };

// "Raise alert" button and its panel, used on Command and Alerts.
export function RaiseAlert({ primary = true }: { primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      try {
        setError(null);
        await callAction(raiseAlertAction)(f);
        setOpen(false);
        setF(EMPTY);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });

  return (
    <>
      <button type="button" className={`btn ${primary ? "btn-primary" : "btn-secondary"}`} onClick={() => { setF(EMPTY); setError(null); setOpen(true); }}><OctagonAlert size={15} /> Raise alert</button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        over="Gatehouse"
        title="Raise a property-wide alert"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={pending} onClick={submit}><OctagonAlert size={15} /> {pending ? "Raising…" : "Raise alert"}</button></>}
      >
        <div className="field"><span className="flabel">Type</span><div className="seg" role="group" aria-label="Type">{GH_ALERT_TYPES.map((t) => <button key={t} type="button" aria-pressed={f.type === t} onClick={() => setF({ ...f, type: t })}>{t}</button>)}</div></div>
        <div className="field"><span className="flabel">Severity</span><div className="seg" role="group" aria-label="Severity">{GH_SEVERITIES.map((s) => <button key={s} type="button" aria-pressed={f.severity === s} onClick={() => setF({ ...f, severity: s })}>{s}</button>)}</div></div>
        <div className="field">
          <label htmlFor="al-loc">Location</label>
          <input className="input" id="al-loc" list="al-places" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Back gate, Block B stairwell" autoComplete="off" />
          <datalist id="al-places">{GH_PLACES.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="field"><label htmlFor="al-msg">Message</label><textarea className="input" id="al-msg" rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="What’s happening and what’s needed, e.g. Two people tried the back gate lock. Second officer to the back gate, please." /></div>
        <div className="pill-note t-warn"><Bell size={16} /><span>Every signed-in Gatehouse screen shows this alert and plays a chime until someone acknowledges it.</span></div>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>
    </>
  );
}
