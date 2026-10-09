import { requirePageAccess } from "@/lib/auth";
import { buildSpendingCsv, type SpendingExport } from "@/lib/reports/spending";
import { csvResponse } from "@/lib/csv";
import { lagosToday } from "@/lib/periods";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  await requirePageAccess("/spending");
  const params = new URL(request.url).searchParams;
  const kind: SpendingExport = params.get("kind") === "units" ? "units" : "purchases";
  const today = lagosToday();
  const from = DATE.test(params.get("from") ?? "") ? params.get("from")! : `${today.slice(0, 4)}-01-01`;
  const to = DATE.test(params.get("to") ?? "") ? params.get("to")! : today;
  const { csv, filename } = await buildSpendingCsv(kind, from, to);
  return csvResponse(csv, filename);
}
