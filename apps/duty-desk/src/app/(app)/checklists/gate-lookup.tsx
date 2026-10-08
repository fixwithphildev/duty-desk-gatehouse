"use client";

import { useState } from "react";
import { Search, DoorOpen, DoorClosed } from "lucide-react";
import type { ChecklistRow, InProgressChecklist } from "@/lib/data/checklists";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function GateLookup({
  latestByApartment,
  inProgressByApartment,
  totalItems,
}: {
  latestByApartment: Record<string, ChecklistRow>;
  inProgressByApartment: Record<string, InProgressChecklist>;
  totalItems: number;
}) {
  const [lookup, setLookup] = useState("");
  const key = lookup.trim().toLowerCase();
  const result = key ? latestByApartment[key] : null;
  // Someone is checking it right now: don't sell it until that's submitted,
  // even if the last submitted checklist said Ready.
  const inspecting = key ? inProgressByApartment[key] : null;

  return (
    <div className="card gate-card">
      <div className="card-head"><span>Front desk check-in gate</span></div>
      <p className="gate-copy">Enter an apartment number to confirm it's ready before check-in.</p>
      <div className="gate-search">
        <Search size={15} />
        <input className="input input-plain" placeholder="e.g. 12B" value={lookup} onChange={(e) => setLookup(e.target.value)} />
      </div>
      {lookup.trim() ? (
        inspecting ? (
          <div className="gate-result tone-gold">
            <DoorClosed size={18} />
            <div>
              <div className="gate-status">BEING CHECKED NOW — wait until it&apos;s submitted</div>
              <div className="gate-meta mono">
                {inspecting.prepared_by_name} started at {fmtTime(inspecting.started_at)} · {inspecting.answered}/{totalItems} checked
                {result ? ` · last result: ${result.overall_ready ? "Ready" : "Not Ready"}` : ""}
              </div>
            </div>
          </div>
        ) : result ? (
          <div className={`gate-result tone-${result.overall_ready ? "teal" : "red"}`}>
            {result.overall_ready ? <DoorOpen size={18} /> : <DoorClosed size={18} />}
            <div>
              <div className="gate-status">{result.overall_ready ? "READY for check-in" : "NOT READY — check-in blocked"}</div>
              <div className="gate-meta mono">Last checked by {result.prepared_by_name} · {fmtTime(result.created_at)}</div>
            </div>
          </div>
        ) : (
          <div className="gate-result tone-neutral">
            <DoorClosed size={18} />
            <div className="gate-status">No submitted checklist found — check-in blocked</div>
          </div>
        )
      ) : null}
    </div>
  );
}
