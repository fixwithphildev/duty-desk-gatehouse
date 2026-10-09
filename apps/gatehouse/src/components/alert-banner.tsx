"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Flame, HeartPulse, Lock, OctagonAlert, ShieldAlert } from "lucide-react";
import { acknowledgeAlertAction, resolveAlertAction } from "@/app/(app)/alerts/actions";
import { playChime } from "@/components/notifications";
import { errorMessage, isRedirectError } from "@/lib/utils";
import { callAction } from "@/lib/action";

export interface BannerAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  location: string | null;
  raisedBy: string;
  raisedAt: string; // "21:47"
  createdAt: string;
  status: "Unacknowledged" | "Acknowledged" | "Resolved";
  ackBy: string | null;
  ackAt: string | null; // "21:55"
}

const ICON: Record<string, typeof Flame> = { Fire: Flame, "Medical Emergency": HeartPulse, "Security Breach": ShieldAlert, Lockdown: Lock };
const CHIME_EVERY_MS = 15_000;

// The property-wide alert, above every Gatehouse page. Until someone
// acknowledges it, it's red and chimes; after that it stays (quieter) until
// it's resolved with notes.
export function AlertBanner({ alert, more, canAct }: { alert: BannerAlert; more: number; canAct: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mins, setMins] = useState(0);
  const unack = alert.status === "Unacknowledged";

  useEffect(() => {
    const tick = () => setMins(Math.max(0, Math.round((Date.now() - new Date(alert.createdAt).getTime()) / 60000)));
    tick();
    const i = setInterval(tick, 20_000);
    return () => clearInterval(i);
  }, [alert.createdAt]);
  useEffect(() => {
    if (!unack) return;
    const i = setInterval(() => { if (document.visibilityState === "visible") playChime(); }, CHIME_EVERY_MS);
    return () => clearInterval(i);
  }, [unack, alert.id]);
  useEffect(() => { setResolving(false); setNotes(""); setError(null); }, [alert.id]);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        setError(null);
        await fn();
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });

  const Icon = ICON[alert.type] ?? OctagonAlert;
  const where = alert.location ? ` · ${alert.location}` : "";
  return (
    <div className={`alert-bn ${unack ? "" : "acked"}`} role={unack ? "alert" : "status"}>
      <div className="ic"><Icon size={20} /></div>
      <div className="tx">
        {unack ? (
          <>
            <b>{alert.type.toUpperCase()}{where}</b>
            <span>{alert.severity} · raised {alert.raisedAt} by {alert.raisedBy} · nobody has acknowledged it for {mins} min · {alert.message}</span>
          </>
        ) : (
          <>
            <b>{alert.type}{where} · acknowledged</b>
            <span>Acknowledged by {alert.ackBy ?? "someone"} at {alert.ackAt ?? "—"} · {alert.message} · waiting for the all-clear</span>
          </>
        )}
        {more ? <span style={{ display: "block", marginTop: 4 }}><Link className="link" href="/alerts">{more} more alert{more === 1 ? "" : "s"} open</Link></span> : null}
        {resolving ? (
          <div className="vstack" style={{ marginTop: 10, gap: 8 }}>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened and the all-clear, e.g. False alarm, smoke from the generator. Fire team checked, all clear 22:20." aria-label="How it was resolved" autoFocus />
            <div className="hstack">
              <button type="button" className="btn btn-primary btn-sm" disabled={pending || !notes.trim()} onClick={() => run(() => callAction(resolveAlertAction)(alert.id, notes))}><Check size={14} /> {pending ? "Saving…" : "Resolve"}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResolving(false)}>Cancel</button>
            </div>
          </div>
        ) : null}
        {error ? <div className="err-note" role="alert" style={{ marginTop: 8 }}>{error}</div> : null}
      </div>
      <Link href={`/alerts?id=${alert.id}`} className="btn btn-secondary btn-sm">Open alert</Link>
      {canAct && unack ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => callAction(acknowledgeAlertAction)(alert.id))}><Check size={15} /> {pending ? "Saving…" : "Acknowledge"}</button> : null}
      {canAct && !unack && !resolving ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResolving(true)}>Resolve with notes</button> : null}
    </div>
  );
}
