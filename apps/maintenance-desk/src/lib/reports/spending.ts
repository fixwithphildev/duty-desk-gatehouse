import "server-only";
import { getDesk } from "@/lib/data/desk";
import { toCsv } from "@/lib/csv";
import { MD_UNITS } from "@/lib/types";
import type { JobView } from "@/lib/jobs";
import type { ExpenseLine } from "@/lib/data/expenses";

// Spending by unit, counted by the day each thing was bought (a YYYY-MM-DD
// string, so no timezone can move a purchase into the wrong month).

export type Asker = "Duty Desk (ROs)" | "Management requests" | "Maintenance team" | "Unit stock";
export const ASKERS: Asker[] = ["Duty Desk (ROs)", "Management requests", "Maintenance team", "Unit stock"];

export interface Spend {
  line: ExpenseLine;
  unit: string;
  job: JobView | null;
  asker: Asker;
}

export function askerOf(job: JobView | null): Asker {
  if (!job) return "Unit stock";
  if (!job.isRequest) return "Duty Desk (ROs)";
  return job.requester?.unit || job.requester?.role === "Maintenance team" ? "Maintenance team" : "Management requests";
}

export async function getSpends(): Promise<Spend[]> {
  const { jobs, expenses } = await getDesk();
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return expenses.map((line) => {
    const job = line.ticket_id ? byId.get(line.ticket_id) ?? null : null;
    return { line, unit: line.unit ?? job?.unit ?? "Other", job, asker: askerOf(job) };
  });
}

// The last 12 months, oldest first: "2026-10".
export function last12Months(today: string): string[] {
  const out: string[] = [];
  const d = new Date(today.slice(0, 7) + "-01T12:00:00Z");
  for (let i = 11; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCMonth(d.getUTCMonth() - i);
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
}

export const monthName = (ym: string, style: "short" | "long" = "short") => new Date(ym + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: style, timeZone: "UTC" });

export type SpendingExport = "purchases" | "units";

export async function buildSpendingCsv(kind: SpendingExport, from: string, to: string): Promise<{ csv: string; filename: string }> {
  const spends = (await getSpends()).filter((s) => s.line.purchased_on >= from && s.line.purchased_on <= to);
  if (kind === "purchases") {
    const rows = spends
      .sort((a, b) => a.line.purchased_on.localeCompare(b.line.purchased_on))
      .map((s) => ({
        date: s.line.purchased_on,
        unit: s.unit,
        item: s.line.item,
        qty: s.line.quantity,
        unitCost: s.line.unit_cost,
        total: s.line.line_total,
        supplier: s.line.supplier ?? "",
        forWhat: s.job ? `${s.job.ref} ${s.job.title}` : "Unit stock",
        area: s.job?.area ?? "",
        asker: s.asker,
        by: s.line.recorded_by_name,
      }));
    const csv = toCsv(rows, [
      { key: "date", label: "Date bought" },
      { key: "unit", label: "Unit" },
      { key: "item", label: "Item" },
      { key: "qty", label: "Qty" },
      { key: "unitCost", label: "Unit cost (NGN)" },
      { key: "total", label: "Total (NGN)" },
      { key: "supplier", label: "Supplier" },
      { key: "forWhat", label: "For" },
      { key: "area", label: "Area" },
      { key: "asker", label: "Asked for by" },
      { key: "by", label: "Recorded by" },
    ]);
    return { csv, filename: `maintenance-purchases-${from}-to-${to}.csv` };
  }
  // One row per month and unit: jobs, stock and the total.
  const months = [...new Set(spends.map((s) => s.line.purchased_on.slice(0, 7)))].sort();
  const rows = months.flatMap((m) =>
    MD_UNITS.map((u) => {
      const ps = spends.filter((s) => s.unit === u && s.line.purchased_on.startsWith(m));
      const jobs = ps.filter((s) => s.job).reduce((a, s) => a + s.line.line_total, 0);
      const stock = ps.filter((s) => !s.job).reduce((a, s) => a + s.line.line_total, 0);
      return { month: m, unit: u, items: ps.length, jobCount: new Set(ps.filter((s) => s.job).map((s) => s.job!.id)).size, jobs, stock, total: jobs + stock };
    })
  );
  const csv = toCsv(rows, [
    { key: "month", label: "Month" },
    { key: "unit", label: "Unit" },
    { key: "items", label: "Items bought" },
    { key: "jobCount", label: "Jobs" },
    { key: "jobs", label: "Spent on jobs (NGN)" },
    { key: "stock", label: "Spent on stock (NGN)" },
    { key: "total", label: "Total (NGN)" },
  ]);
  return { csv, filename: `maintenance-units-by-month-${from}-to-${to}.csv` };
}
