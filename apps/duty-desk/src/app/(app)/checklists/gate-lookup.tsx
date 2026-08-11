"use client";

import { useState } from "react";
import { Search, DoorOpen, DoorClosed } from "lucide-react";
import type { ChecklistRow } from "@/lib/data/checklists";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function GateLookup({ latestByApartment }: { latestByApartment: Record<string, ChecklistRow> }) {
  const [lookup, setLookup] = useState("");
  const result = lookup.trim() ? latestByApartment[lookup.trim().toLowerCase()] : null;

  return (
    <div className="card gate-card">
      <div className="card-head"><span>Front desk check-in gate</span></div>
      <p className="gate-copy">Enter an apartment number to confirm it's ready before check-in.</p>
      <div className="gate-search">
        <Search size={15} />
        <input className="input input-plain" placeholder="e.g. 12B" value={lookup} onChange={(e) => setLookup(e.target.value)} />
      </div>
      {lookup.trim() ? (
        result ? (
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
