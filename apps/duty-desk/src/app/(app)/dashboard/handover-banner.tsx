"use client";

import { useTransition } from "react";
import { BookOpen, Check } from "lucide-react";
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
      <BookOpen size={16} />
      <div className="handover-main">
        <div className="handover-title">Last shift handover — {handover.officer_name}, {fmtTime(handover.created_at)}</div>
        <div className="handover-note">{handover.notes}</div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm handover-ack" disabled={pending} onClick={acknowledge}>
        <Check size={13} /> {pending ? "Marking…" : "Mark as handled"}
      </button>
    </div>
  );
}
