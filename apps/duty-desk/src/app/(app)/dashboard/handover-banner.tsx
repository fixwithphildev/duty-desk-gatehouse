"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Repeat2, Check } from "lucide-react";
import { acknowledgeHandoverAction } from "../dutylog/actions";
import { isRedirectError, errorMessage } from "@/lib/utils";

interface Handover {
  id: string;
  officer_name: string;
  notes: string;
  when: string;
  mine: boolean;
}

// The last shift's handover note, until someone on the next shift acknowledges it.
export function HandoverBanner({ handover }: { handover: Handover | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!handover) return null;

  const acknowledge = () =>
    startTransition(async () => {
      try { await acknowledgeHandoverAction(handover.id); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); }
    });

  return (
    <section className="handover" aria-label="Shift handover">
      <div className="ic"><Repeat2 size={18} /></div>
      <div className="tx">
        <b>{handover.mine ? "Your handover note" : `Handover from ${handover.officer_name}`} · {handover.when}</b>
        <p style={{ whiteSpace: "pre-line" }}>{handover.notes}</p>
        {error ? <p className="err-note" role="alert" style={{ marginTop: 8 }}>{error}</p> : null}
      </div>
      <div className="acts">
        {handover.mine ? <span className="hint">Waiting for the next shift to acknowledge</span> : (
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={acknowledge}>
            <Check size={14} /> {pending ? "Saving…" : "Acknowledge"}
          </button>
        )}
      </div>
    </section>
  );
}
