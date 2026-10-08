import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { getAllChecklists, getChecklistsInProgress, getLatestSubmittedByApartment } from "@/lib/data/checklists";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import { Badge } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { GateLookup } from "./gate-lookup";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function checklistTypeLabel(type: string): string {
  return type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection";
}

export default async function ChecklistsPage() {
  const session = await requirePageAccess("/checklists");
  const [all, latest, inProgress] = await Promise.all([getAllChecklists(), getLatestSubmittedByApartment(), getChecklistsInProgress()]);
  const latestByApartment: Record<string, (typeof latest)[number]> = {};
  for (const c of latest) latestByApartment[c.apartment.trim().toLowerCase()] = c;
  const inProgressByApartment: Record<string, (typeof inProgress)[number]> = {};
  for (const c of inProgress) inProgressByApartment[c.apartment.trim().toLowerCase()] = c;
  const totalItems = DD_ALL_ITEMS.length;

  const canCreate = DD_CAN_EDIT_CHECKLISTS.includes(session.role);

  return (
    <div className="view">
      <div className="view-head">
        <h2>Apartment Readiness Checklists</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AutoRefresh />
          {canCreate ? (
            <Link href="/checklists/new" className="btn btn-primary">
              <Plus size={15} /> New checklist
            </Link>
          ) : null}
        </div>
      </div>

      <GateLookup latestByApartment={latestByApartment} inProgressByApartment={inProgressByApartment} totalItems={totalItems} />

      <div className="card">
        <div className="card-head"><span>Being inspected now</span><span className="cell-sub" style={{ margin: 0 }}>{inProgress.length} in progress</span></div>
        {inProgress.length === 0 ? (
          <p className="gate-copy" style={{ margin: 0 }}>No one is inspecting an apartment right now.</p>
        ) : (
          <ul className="feed">
            {inProgress.map((c) => {
              const mine = c.prepared_by === session.staffId;
              return (
                <li key={c.id}>
                  <Link href={`/checklists/${c.id}`} className="feed-row">
                    <span className="feed-dot tone-gold" />
                    <div className="feed-main">
                      <div className="feed-label">Apartment {c.apartment} · {checklistTypeLabel(c.type)}</div>
                      <div className="feed-meta mono">
                        {mine ? "You" : c.prepared_by_name} · started {fmtTime(c.started_at)} · {c.answered}/{totalItems} checked · saved {fmtTime(c.updated_at)}
                      </div>
                    </div>
                    <Badge tone={mine ? "teal" : "gold"}>{mine ? "Continue" : "In progress"}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Apartment</th><th>Type</th><th>Prepared by</th><th>Date</th><th>Ready</th><th /></tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.id} style={c.void ? { opacity: 0.6 } : undefined}>
                <td className="cell-title">
                  {c.apartment}
                  {c.void ? <div className="cell-sub" style={{ color: "var(--red)" }}>Voided</div> : null}
                </td>
                <td>{checklistTypeLabel(c.type)}</td>
                <td>{c.prepared_by_name}</td>
                <td className="mono">{fmtTime(c.created_at)}</td>
                <td>{c.void ? <Badge tone="neutral">Voided</Badge> : <Badge tone={c.overall_ready ? "teal" : "red"}>{c.overall_ready ? "Ready" : "Not Ready"}</Badge>}</td>
                <td><Link href={`/checklists/${c.id}`} className="btn btn-ghost btn-sm">View</Link></td>
              </tr>
            ))}
            {all.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", opacity: 0.75 }}>No checklists submitted yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
