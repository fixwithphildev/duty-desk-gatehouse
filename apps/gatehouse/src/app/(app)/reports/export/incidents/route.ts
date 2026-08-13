import { requirePageAccess } from "@/lib/auth";
import { buildReportCsv } from "@/lib/reports/exports";
import { csvResponse } from "@/lib/csv";

export async function GET() {
  await requirePageAccess("/reports");
  const { csv, filename } = await buildReportCsv("incidents");
  return csvResponse(csv, filename);
}
