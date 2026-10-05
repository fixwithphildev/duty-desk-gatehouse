import { requirePageAccess } from "@/lib/auth";
import { buildSpendingCsv, parseReportParams, type SpendingExport } from "@/lib/reports/spending";
import { csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  await requirePageAccess("/spending");
  const params = new URL(request.url).searchParams;
  const kind: SpendingExport = params.get("kind") === "itemized" ? "itemized" : "summary";
  const { granularity, from, to } = parseReportParams({ period: params.get("period"), from: params.get("from"), to: params.get("to") });
  const { csv, filename } = await buildSpendingCsv(kind, granularity, from, to);
  return csvResponse(csv, filename);
}
