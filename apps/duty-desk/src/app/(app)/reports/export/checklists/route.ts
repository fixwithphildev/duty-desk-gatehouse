import type { NextRequest } from "next/server";
import { requirePageAccess } from "@/lib/auth";
import { buildReportCsv } from "@/lib/reports/exports";
import { csvResponse } from "@/lib/csv";
import { filterFromParams } from "@/lib/checklist-history";

// With no query this is every submitted checklist; the Checklists page's
// "Export these" adds its filters (type, issues, from, to, q).
export async function GET(req: NextRequest) {
  await requirePageAccess("/reports");
  const { csv, filename } = await buildReportCsv("checklists", filterFromParams(Object.fromEntries(req.nextUrl.searchParams)));
  return csvResponse(csv, filename);
}
