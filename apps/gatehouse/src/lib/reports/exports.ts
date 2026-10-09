import "server-only";
import { getAllVehicleLogs } from "@/lib/data/vehicles";
import { getItemLogs } from "@/lib/data/items";
import { getIncidents } from "@/lib/data/incidents";
import { getPatrols } from "@/lib/data/patrols";
import { getAlerts } from "@/lib/data/alerts";
import { toCsv } from "@/lib/csv";

export type ReportDataset = "vehicles" | "items" | "incidents" | "patrols" | "alerts";

export const REPORT_DATASETS: ReportDataset[] = ["vehicles", "items", "incidents", "patrols", "alerts"];
export const REPORT_DATASET_LABELS: Record<ReportDataset, string> = {
  vehicles: "Vehicle log",
  items: "Items book",
  incidents: "Incidents",
  patrols: "Patrols",
  alerts: "Alerts",
};

const TZ = "Africa/Lagos";
// Dates as people read them in Lagos, e.g. "09/10/2026, 21:47".
const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) : "");
const voidCols = (r: { void: boolean; void_reason: string | null; voided_by_name: string | null }) => ({ voided: r.void ? "Yes" : "", void_reason: r.void_reason ?? "", voided_by: r.voided_by_name ?? "" });
const VOID_COLS = [
  { key: "voided" as const, label: "Voided" },
  { key: "void_reason" as const, label: "Void Reason" },
  { key: "voided_by" as const, label: "Voided By" },
];

export async function buildReportCsv(dataset: ReportDataset): Promise<{ csv: string; filename: string }> {
  const filename = `gatehouse-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;

  if (dataset === "vehicles") {
    const rows = (await getAllVehicleLogs()).map((v) => ({ card: v.card, plate: v.plate, driver: v.driver ?? "", in: local(v.entry_at), out: local(v.exit_at), status: v.status === "In" ? "On property" : "Returned", logged_by: v.logged_by_name ?? "", out_by: v.exit_by_name ?? "", ...voidCols(v) }));
    return { filename, csv: toCsv(rows, [{ key: "card", label: "Card" }, { key: "plate", label: "Plate" }, { key: "driver", label: "Driver / Purpose" }, { key: "in", label: "In" }, { key: "out", label: "Out" }, { key: "status", label: "Status" }, { key: "logged_by", label: "Logged In By" }, { key: "out_by", label: "Logged Out By" }, ...VOID_COLS]) };
  }
  if (dataset === "items") {
    const rows = (await getItemLogs()).map((i) => ({ item: i.item, carried_by: i.carried_by, authorized_by: i.authorized_by ?? "", out: local(i.out_at), in: local(i.in_at), status: i.status, logged_by: i.logged_by_name ?? "", in_by: i.in_by_name ?? "", ...voidCols(i) }));
    return { filename, csv: toCsv(rows, [{ key: "item", label: "Item" }, { key: "carried_by", label: "Carried By" }, { key: "authorized_by", label: "Authorised By" }, { key: "out", label: "Out" }, { key: "in", label: "Back In" }, { key: "status", label: "Status" }, { key: "logged_by", label: "Logged Out By" }, { key: "in_by", label: "Booked In By" }, ...VOID_COLS]) };
  }
  if (dataset === "incidents") {
    const rows = (await getIncidents()).map((i) => ({ ref: i.ref, reported_at: local(i.created_at), title: i.title, category: i.category, severity: i.severity, location: i.location ?? "", reported_by: i.reported_by_name, status: i.status, description: i.description ?? "", resolved_at: local(i.resolved_at), resolved_by: i.resolved_by_name ?? "", resolution: i.resolution_notes ?? "", ...voidCols(i) }));
    return { filename, csv: toCsv(rows, [{ key: "ref", label: "Ref" }, { key: "reported_at", label: "Reported At" }, { key: "title", label: "Title" }, { key: "category", label: "Category" }, { key: "severity", label: "Severity" }, { key: "location", label: "Location" }, { key: "reported_by", label: "Reported By" }, { key: "status", label: "Status" }, { key: "description", label: "Description" }, { key: "resolved_at", label: "Resolved At" }, { key: "resolved_by", label: "Resolved By" }, { key: "resolution", label: "How It Was Resolved" }, ...VOID_COLS]) };
  }
  if (dataset === "patrols") {
    const rows = (await getPatrols()).map((p) => ({ officer: p.officer_name, route: p.route, started: local(p.started_at), ended: local(p.ended_at), status: p.status, notes: p.notes ?? "", ...voidCols(p) }));
    return { filename, csv: toCsv(rows, [{ key: "officer", label: "Officer" }, { key: "route", label: "Route" }, { key: "started", label: "Started" }, { key: "ended", label: "Finished" }, { key: "status", label: "Status" }, { key: "notes", label: "Notes" }, ...VOID_COLS]) };
  }
  const rows = (await getAlerts()).map((a) => ({ raised_at: local(a.created_at), type: a.type, severity: a.severity, location: a.location ?? "", message: a.message, raised_by: a.raised_by_name, status: a.status, acknowledged_by: a.acknowledged_by_name ?? "", acknowledged_at: local(a.acknowledged_at), resolved_by: a.resolved_by_name ?? "", resolved_at: local(a.resolved_at), resolution: a.resolution_notes ?? "", ...voidCols(a) }));
  return { filename, csv: toCsv(rows, [{ key: "raised_at", label: "Raised At" }, { key: "type", label: "Type" }, { key: "severity", label: "Severity" }, { key: "location", label: "Location" }, { key: "message", label: "Message" }, { key: "raised_by", label: "Raised By" }, { key: "status", label: "Status" }, { key: "acknowledged_by", label: "Acknowledged By" }, { key: "acknowledged_at", label: "Acknowledged At" }, { key: "resolved_by", label: "Resolved By" }, { key: "resolved_at", label: "Resolved At" }, { key: "resolution", label: "How It Was Resolved" }, ...VOID_COLS]) };
}
