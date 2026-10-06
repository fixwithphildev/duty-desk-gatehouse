"use client";

import { useTransition } from "react";
import { Repeat2, Check } from "lucide-react";
import { acknowledgeHandoverAction } from "./actions";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Handover {
  id: string;
  officer_name: string;
  notes: string;
  created_at: string;
}

export function HandoverBanner({ handover }: { handover: Handover | null }) {
  const [pending, startTransition] = useTransition();

  if (!handover) return null;

  const acknowledge = () => startTransition(async () => { await acknowledgeHandoverAction(handover.id); });

  return (
    <div className="handover-banner">
      <div className="handover-icon"><Repeat2 size={18} /></div>
      <div className="handover-main">
        <div className="handover-title">Handover from {handover.officer_name}</div>
        <div className="handover-meta">Last shift · {fmtTime(handover.created_at)}</div>
        <div className="handover-note">&ldquo;{handover.notes}&rdquo;</div>
      </div>
      <button type="button" className="btn handover-ack" disabled={pending} onClick={acknowledge}>
        <Check size={15} /> {pending ? "Marking…" : "Mark as handled"}
      </button>
    </div>
  );
}
