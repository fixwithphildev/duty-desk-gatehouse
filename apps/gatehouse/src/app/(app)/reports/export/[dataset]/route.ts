import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { buildReportCsv, REPORT_DATASETS, type ReportDataset } from "@/lib/reports/exports";
import { csvResponse } from "@/lib/csv";

// /reports/export/vehicles, /items, /incidents, /patrols, /alerts
export async function GET(_req: Request, { params }: { params: { dataset: string } }) {
  await requireSession();
  if (!REPORT_DATASETS.includes(params.dataset as ReportDataset)) notFound();
  const { csv, filename } = await buildReportCsv(params.dataset as ReportDataset);
  return csvResponse(csv, filename);
}
