"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Lock } from "lucide-react";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import type { InProgressChecklist } from "@/lib/data/checklists";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { takeOverChecklistAction } from "./new/actions";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

// Shown instead of the form when someone else is already inspecting the
// apartment: who, since when, how far they've got, and — for officers who
// can do checklists — the option to take it over (e.g. at a shift change).
export function InspectionLock({ draft, canTakeOver }: { draft: InProgressChecklist; canTakeOver: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = DD_ALL_ITEMS.length;
  const first = draft.prepared_by_name.split(" ")[0];
  const initials = draft.prepared_by_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const takeOver = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await callAction(takeOverChecklistAction)(draft.id);
        if (!result.ok) {
          setError("This inspection has just been submitted or stopped.");
          router.refresh();
          return;
        }
        router.push(`/checklists/${draft.id}`);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <section className="card">
      <div className="card-h"><Lock size={16} /><h3>Already being inspected</h3></div>
      <div className="card-b vstack" style={{ gap: 16 }}>
        <div className="lock-who">
          <span className="av" aria-hidden="true">{initials}</span>
          <div className="vstack" style={{ gap: 2 }}>
            <b>{draft.prepared_by_name}</b>
            <span className="muted" style={{ fontSize: 13 }}>Started {fmtTime(draft.started_at)} · {draft.answered} of {total} checks done · last saved {fmtTime(draft.updated_at)}</span>
            {draft.taken_over_from_name && draft.taken_over_at ? <span className="muted" style={{ fontSize: 13 }}>Taken over from {draft.taken_over_from_name} at {fmtTime(draft.taken_over_at)}</span> : null}
          </div>
        </div>
        <div className="bar-prog" role="img" aria-label={`${draft.answered} of ${total} checked`}><span style={{ width: `${(draft.answered / total) * 100}%` }} /></div>
        <p style={{ margin: 0, color: "var(--text-2)" }}>
          Two people can’t inspect the same apartment at once, so their answers don’t clash. {first} can carry on from any phone or computer;
          nothing is lost if their phone dies.
        </p>
        {canTakeOver ? (
          confirming ? (
            <div className="pill-note t-info" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <span>Take over from {first}? Their {draft.answered} answers are kept, and the checklist will show that you took over and when.</span>
              <div className="hstack">
                <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={takeOver}>{pending ? "Taking over…" : "Yes, take over"}</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="pill-note t-info">
              <History size={16} />
              <span style={{ flex: 1 }}>If {first} has gone off shift or can’t finish, you can take it over. Their answers are kept, and the record shows you took over and when.</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(true)}>Take over from {first}</button>
            </div>
          )
        ) : null}
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </div>
    </section>
  );
}
