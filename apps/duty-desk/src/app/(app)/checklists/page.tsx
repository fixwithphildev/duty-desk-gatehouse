import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { getAllChecklists, getLatestSubmittedByApartment } from "@/lib/data/checklists";
import { Badge } from "@/components/ui";
import { GateLookup } from "./gate-lookup";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function checklistTypeLabel(type: string): string {
  return type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection";
}

export default async function ChecklistsPage() {
  const session = await requirePageAccess("/checklists");
  const [all, latest] = await Promise.all([getAllChecklists(), getLatestSubmittedByApartment()]);
  const latestByApartment: Record<string, (typeof latest)[number]> = {};
  for (const c of latest) latestByApartment[c.apartment.trim().toLowerCase()] = c;

  const canCreate = DD_CAN_EDIT_CHECKLISTS.includes(session.role);

  return (
    <div className="view">
      <div className="view-head">
        <h2>Apartment Readiness Checklists</h2>
        {canCreate ? (
          <Link href="/checklists/new" className="btn btn-primary">
            <Plus size={15} /> New checklist
          </Link>
        ) : null}
      </div>

      <GateLookup latestByApartment={latestByApartment} />

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Apartment</th><th>Type</th><th>Prepared by</th><th>Date</th><th>Ready</th><th /></tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.id}>
                <td className="cell-title">{c.apartment}</td>
                <td>{checklistTypeLabel(c.type)}</td>
                <td>{c.prepared_by_name}</td>
                <td className="mono">{fmtTime(c.created_at)}</td>
                <td><Badge tone={c.overall_ready ? "teal" : "red"}>{c.overall_ready ? "Ready" : "Not Ready"}</Badge></td>
                <td><Link href={`/checklists/${c.id}`} className="btn btn-ghost btn-sm">View</Link></td>
              </tr>
            ))}
            {all.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>No checklists submitted yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
