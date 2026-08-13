import "server-only";
import { getIncidents } from "@/lib/data/incidents";
import { getPatrols } from "@/lib/data/patrols";
import { getAlerts } from "@/lib/data/alerts";
import { toCsv } from "@/lib/csv";

export type ReportDataset = "incidents" | "patrols" | "alerts";

export const REPORT_DATASET_LABELS: Record<ReportDataset, string> = {
  incidents: "Incidents",
  patrols: "Patrols",
  alerts: "Alerts",
};

export async function buildReportCsv(dataset: ReportDataset): Promise<{ csv: string; filename: string }> {
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (dataset === "incidents") {
    const incidents = await getIncidents();
    const csv = toCsv(
      incidents.map((i) => ({
        reported_at: i.created_at,
        title: i.title,
        category: i.category,
        severity: i.severity,
        location: i.location ?? "",
        reported_by: i.reported_by_name,
        status: i.status,
        description: i.description ?? "",
      })),
      [
        { key: "reported_at", label: "Reported At" },
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "severity", label: "Severity" },
        { key: "location", label: "Location" },
        { key: "reported_by", label: "Reported By" },
        { key: "status", label: "Status" },
        { key: "description", label: "Description" },
      ]
    );
    return { csv, filename: `gatehouse-incidents-${dateStamp}.csv` };
  }

  if (dataset === "patrols") {
    const patrols = await getPatrols();
    const csv = toCsv(
      patrols.map((p) => ({
        officer: p.officer_name,
        route: p.route,
        started_at: p.started_at,
        ended_at: p.ended_at ?? "",
        status: p.status,
        notes: p.notes ?? "",
      })),
      [
        { key: "officer", label: "Officer" },
        { key: "route", label: "Route" },
        { key: "started_at", label: "Started At" },
        { key: "ended_at", label: "Ended At" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Notes" },
      ]
    );
    return { csv, filename: `gatehouse-patrols-${dateStamp}.csv` };
  }

  const alerts = await getAlerts();
  const csv = toCsv(
    alerts.map((a) => ({
      raised_at: a.created_at,
      type: a.type,
      severity: a.severity,
      message: a.message,
      location: a.location ?? "",
      raised_by: a.raised_by_name,
      status: a.status,
      acknowledged_by: a.acknowledged_by_name ?? "",
    })),
    [
      { key: "raised_at", label: "Raised At" },
      { key: "type", label: "Type" },
      { key: "severity", label: "Severity" },
      { key: "message", label: "Message" },
      { key: "location", label: "Location" },
      { key: "raised_by", label: "Raised By" },
      { key: "status", label: "Status" },
      { key: "acknowledged_by", label: "Acknowledged By" },
    ]
  );
  return { csv, filename: `gatehouse-alerts-${dateStamp}.csv` };
}
