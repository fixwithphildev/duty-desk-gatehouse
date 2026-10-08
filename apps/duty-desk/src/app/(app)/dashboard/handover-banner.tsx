"use client";

import { useTransition } from "react";
import { Repeat2, Check } from "lucide-react";
import { acknowledgeHandoverAction } from "./actions";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}

interface Handover {
  id: string;
  officer_name: string;
  notes: string;
  created_at: string;
}

// The last shift's handover note, until someone marks it as handled.
export function HandoverBanner({ handover }: { handover: Handover | null }) {
  const [pending, startTransition] = useTransition();

  if (!handover) return null;

  const acknowledge = () => startTransition(async () => { await acknowledgeHandoverAction(handover.id); });

  return (
    <section className="handover" aria-label="Shift handover">
      <div className="ic"><Repeat2 size={18} /></div>
      <div className="tx">
        <b>Handover from {handover.officer_name} · {fmtTime(handover.created_at)}</b>
        <p>{handover.notes}</p>
      </div>
      <div className="acts">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={acknowledge}>
          <Check size={14} /> {pending ? "Marking…" : "Mark as handled"}
        </button>
      </div>
    </section>
  );
}
