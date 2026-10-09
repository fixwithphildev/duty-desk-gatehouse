import "server-only";
import { getAllChecklists, getChecklistIssues } from "@/lib/data/checklists";
import { getComplaints } from "@/lib/data/complaints";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { toCsv } from "@/lib/csv";
import { findApartment } from "@/lib/apartments";
import { clockTime, lagosDayKey } from "@/lib/time";
import { isFiltered, matchesHistory, NO_FILTER, type HistoryFilter } from "@/lib/checklist-history";

export type ReportDataset = "checklists" | "complaints" | "tickets";

export const REPORT_DATASET_LABELS: Record<ReportDataset, string> = {
  checklists: "Checklists",
  complaints: "Complaints",
  tickets: "Maintenance Tickets",
};

// `filter` narrows the checklists export to what's on the Checklists page ("Export these").
export async function buildReportCsv(dataset: ReportDataset, filter: HistoryFilter = NO_FILTER): Promise<{ csv: string; filename: string }> {
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (dataset === "checklists") {
    const [checklists, issues] = await Promise.all([getAllChecklists(), getChecklistIssues()]);
    const rows = checklists
      .map((c) => {
        const apartment = findApartment(c.apartment)?.name ?? c.apartment;
        const list = issues.get(c.id) ?? [];
        return { c, apartment, list, keep: matchesHistory({ apartment, by: c.prepared_by_name, typeKey: c.type === "check_in_prep" ? "in" : "out", day: lagosDayKey(c.created_at), issues: list }, filter) };
      })
      .filter((r) => r.keep);
    const csv = toCsv(
      rows.map(({ c, apartment, list }) => ({
        apartment,
        type: c.type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection",
        prepared_by: c.prepared_by_name,
        // Lagos time, as people at the property read it.
        submitted: `${lagosDayKey(c.created_at)} ${clockTime(c.created_at)}`,
        result: c.void ? "Voided" : c.overall_ready ? "Ready" : "Not Ready",
        issues: list.length,
        flagged: list.map((i) => `${i.name} - ${i.problem}${i.note ? `: ${i.note}` : ""}`).join("; "),
        voided_by: c.void ? c.voided_by_name ?? "" : "",
        void_reason: c.void ? c.void_reason ?? "" : "",
      })),
      [
        { key: "apartment", label: "Apartment" },
        { key: "type", label: "Type" },
        { key: "prepared_by", label: "Prepared By" },
        { key: "submitted", label: "Submitted (Lagos time)" },
        { key: "result", label: "Result" },
        { key: "issues", label: "Issues" },
        { key: "flagged", label: "Flagged Items" },
        { key: "voided_by", label: "Voided By" },
        { key: "void_reason", label: "Void Reason" },
      ]
    );
    return { csv, filename: `duty-desk-checklists-${dateStamp}${isFiltered(filter) ? "-filtered" : ""}.csv` };
  }

  if (dataset === "complaints") {
    const complaints = await getComplaints();
    const csv = toCsv(
      complaints.map((c) => ({
        logged_at: c.created_at,
        guest_name: c.guest_name ?? "",
        room: c.room ?? "",
        category: c.category,
        priority: c.priority,
        description: c.description,
        status: c.status,
      })),
      [
        { key: "logged_at", label: "Logged At" },
        { key: "guest_name", label: "Guest" },
        { key: "room", label: "Room" },
        { key: "category", label: "Category" },
        { key: "priority", label: "Priority" },
        { key: "description", label: "Description" },
        { key: "status", label: "Status" },
      ]
    );
    return { csv, filename: `duty-desk-complaints-${dateStamp}.csv` };
  }

  const tickets = await getMaintenanceTickets();
  const csv = toCsv(
    tickets.map((t) => ({
      ref: t.ref_no ? `MT-${String(t.ref_no).padStart(4, "0")}` : "",
      reported_at: t.created_at,
      area: t.area,
      issue: t.issue_type,
      assigned_to: t.assigned_to,
      priority: t.priority,
      status: t.status,
      source: t.source,
      started_by: t.started_by_name ?? "",
      fixed_by: t.resolved_by_name ?? "",
      fixed_at: t.resolved_at ?? "",
      fix_note: t.fix_note ?? "",
      notes: t.notes ?? "",
    })),
    [
      { key: "ref", label: "Ref" },
      { key: "reported_at", label: "Reported At" },
      { key: "area", label: "Area" },
      { key: "issue", label: "Issue" },
      { key: "assigned_to", label: "Assigned To" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "source", label: "Source" },
      { key: "started_by", label: "Started By" },
      { key: "fixed_by", label: "Fixed By" },
      { key: "fixed_at", label: "Fixed At" },
      { key: "fix_note", label: "What Was Done" },
      { key: "notes", label: "Notes" },
    ]
  );
  return { csv, filename: `duty-desk-maintenance-tickets-${dateStamp}.csv` };
}
