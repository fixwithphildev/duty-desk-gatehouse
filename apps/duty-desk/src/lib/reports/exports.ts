import "server-only";
import { getAllChecklists } from "@/lib/data/checklists";
import { getComplaints } from "@/lib/data/complaints";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { toCsv } from "@/lib/csv";

export type ReportDataset = "checklists" | "complaints" | "tickets";

export const REPORT_DATASET_LABELS: Record<ReportDataset, string> = {
  checklists: "Checklists",
  complaints: "Complaints",
  tickets: "Maintenance Tickets",
};

export async function buildReportCsv(dataset: ReportDataset): Promise<{ csv: string; filename: string }> {
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (dataset === "checklists") {
    const checklists = await getAllChecklists();
    const csv = toCsv(
      checklists.map((c) => ({
        apartment: c.apartment,
        type: c.type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection",
        prepared_by: c.prepared_by_name,
        status: c.status,
        ready: c.overall_ready ? "Ready" : "Not Ready",
        submitted_at: c.created_at,
      })),
      [
        { key: "apartment", label: "Apartment" },
        { key: "type", label: "Type" },
        { key: "prepared_by", label: "Prepared By" },
        { key: "status", label: "Status" },
        { key: "ready", label: "Ready" },
        { key: "submitted_at", label: "Submitted At" },
      ]
    );
    return { csv, filename: `duty-desk-checklists-${dateStamp}.csv` };
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
