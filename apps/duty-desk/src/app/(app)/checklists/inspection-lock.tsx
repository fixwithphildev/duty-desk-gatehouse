"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import type { InProgressChecklist } from "@/lib/data/checklists";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { takeOverChecklistAction } from "./new/actions";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
        const result = await takeOverChecklistAction(draft.id);
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
    <div className="card lock-card">
      <div className="lock-head">
        <span className="lock-avatar" aria-hidden="true">{initials}</span>
        <div>
          <div className="lock-title"><Lock size={15} /> Apartment {draft.apartment} is being inspected by {draft.prepared_by_name}</div>
          <div className="cell-sub mono" style={{ maxWidth: "none" }}>
            Started {fmtTime(draft.started_at)} · {draft.answered} of {total} checked · last saved {fmtTime(draft.updated_at)}
          </div>
          {draft.taken_over_from_name && draft.taken_over_at ? (
            <div className="cell-sub" style={{ maxWidth: "none" }}>Taken over from {draft.taken_over_from_name} at {fmtTime(draft.taken_over_at)}</div>
          ) : null}
        </div>
      </div>
      <div className="progress-track" style={{ flex: "none" }} role="img" aria-label={`${draft.answered} of ${total} checked`}>
        <div className="progress-fill" style={{ width: `${(draft.answered / total) * 100}%`, background: "var(--gold)" }} />
      </div>
      <p className="gate-copy" style={{ margin: 0 }}>
        Two people can&apos;t inspect the same apartment at once, so their answers don&apos;t clash. {first} can carry on from any phone or
        computer; nothing is lost if their phone dies.
      </p>
      {canTakeOver ? (
        confirming ? (
          <div className="lock-confirm">
            <span>
              Take over from {first}? Their {draft.answered} answers are kept, and the checklist will show that you took over and when.
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={takeOver}>
                {pending ? "Taking over…" : "Yes, take over"}
              </button>
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>Take over from {first}</button>
          </div>
        )
      ) : null}
      {error ? <div className="login-error" style={{ margin: 0 }}>{error}</div> : null}
    </div>
  );
}
