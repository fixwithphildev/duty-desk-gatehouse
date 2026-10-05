import "server-only";
import { getExpensesInRange, type ExpenseLine } from "@/lib/data/expenses";
import { getTicketSummaries, type TicketSummary } from "@/lib/data/tickets";
import { toCsv } from "@/lib/csv";

// Weekly / monthly / yearly spending reports. Everything buckets by the
// purchase date (a plain YYYY-MM-DD), and all date math is done in UTC on
// those strings, so a server running in another timezone can't shift a
// purchase into the wrong week.

export type Granularity = "weekly" | "monthly" | "yearly";
export const GRANULARITIES: Granularity[] = ["weekly", "monthly", "yearly"];
export const GRANULARITY_LABELS: Record<Granularity, string> = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}
function addMonths(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  return fmt(x);
}
function shortDate(d: string): string {
  const x = parse(d);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

// Today's date at the property (Lagos, UTC+1), not the server's — Vercel
// runs in UTC, which would still be "yesterday" between midnight and 1am.
export function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export function periodStart(d: string, g: Granularity): string {
  if (g === "yearly") return `${d.slice(0, 4)}-01-01`;
  if (g === "monthly") return `${d.slice(0, 7)}-01`;
  // Weeks run Monday–Sunday.
  const dow = (parse(d).getUTCDay() + 6) % 7;
  return addDays(d, -dow);
}

function nextPeriod(start: string, g: Granularity): string {
  if (g === "yearly") return `${Number(start.slice(0, 4)) + 1}-01-01`;
  if (g === "monthly") return addMonths(start, 1);
  return addDays(start, 7);
}

export function periodLabel(start: string, g: Granularity): string {
  if (g === "yearly") return start.slice(0, 4);
  if (g === "monthly") return `${MONTHS[parse(start).getUTCMonth()]} ${start.slice(0, 4)}`;
  return `Week of ${shortDate(start)}`;
}

// The range shown when someone first opens a report: the last 12 weeks,
// the last 12 months, or the last 5 years, ending today.
export function defaultRange(g: Granularity, today = todayLocal()): { from: string; to: string } {
  const thisPeriod = periodStart(today, g);
  if (g === "weekly") return { from: addDays(thisPeriod, -7 * 11), to: today };
  if (g === "monthly") return { from: addMonths(thisPeriod, -11), to: today };
  return { from: `${Number(thisPeriod.slice(0, 4)) - 4}-01-01`, to: today };
}

// Reads ?period=&from=&to= from the URL, falling back to sensible defaults
// for anything missing or malformed.
export function parseReportParams(params: { period?: string | null; from?: string | null; to?: string | null }): {
  granularity: Granularity;
  from: string;
  to: string;
} {
  const granularity = (GRANULARITIES as string[]).includes(params.period ?? "") ? (params.period as Granularity) : "monthly";
  const fallback = defaultRange(granularity);
  let from = params.from && DATE_RE.test(params.from) ? params.from : fallback.from;
  let to = params.to && DATE_RE.test(params.to) ? params.to : fallback.to;
  if (from > to) [from, to] = [to, from];
  return { granularity, from, to };
}

export interface PeriodTotal {
  start: string;
  end: string;
  label: string;
  amount: number;
  purchases: number;
  tickets: number;
}

export interface RankedTotal {
  label: string;
  amount: number;
  count: number;
}

export interface SpendingReport {
  granularity: Granularity;
  from: string;
  to: string;
  total: number;
  purchaseCount: number;
  ticketCount: number;
  averagePerTicket: number;
  periods: PeriodTotal[];
  byDepartment: RankedTotal[];
  topItems: RankedTotal[];
  topAreas: RankedTotal[];
  lines: Array<ExpenseLine & { ticket: TicketSummary | null; period: string }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function rank(map: Map<string, { label: string; amount: number; keys: Set<string> }>, limit?: number): RankedTotal[] {
  const list = [...map.values()]
    .map((v) => ({ label: v.label, amount: round2(v.amount), count: v.keys.size }))
    .sort((a, b) => b.amount - a.amount);
  return limit ? list.slice(0, limit) : list;
}

export async function buildSpendingReport(granularity: Granularity, from: string, to: string): Promise<SpendingReport> {
  const raw = await getExpensesInRange(from, to);
  const tickets = await getTicketSummaries(raw.map((l) => l.ticket_id));

  // Every period in the range appears, including ones with no spending, so
  // the report shows quiet months as ₦0 rather than skipping them.
  const periods = new Map<string, PeriodTotal & { ticketIds: Set<string> }>();
  for (let start = periodStart(from, granularity); start <= to; start = nextPeriod(start, granularity)) {
    // The first and last periods are clipped to the chosen range, so the
    // From/To columns in the export match what was actually counted.
    const end = addDays(nextPeriod(start, granularity), -1);
    periods.set(start, { start: start < from ? from : start, end: end > to ? to : end, label: periodLabel(start, granularity), amount: 0, purchases: 0, tickets: 0, ticketIds: new Set() });
  }

  const departments = new Map<string, { label: string; amount: number; keys: Set<string> }>();
  const items = new Map<string, { label: string; amount: number; keys: Set<string> }>();
  const areas = new Map<string, { label: string; amount: number; keys: Set<string> }>();
  const add = (map: typeof items, key: string, label: string, amount: number, countKey: string) => {
    const entry = map.get(key) ?? { label, amount: 0, keys: new Set<string>() };
    entry.amount += amount;
    entry.keys.add(countKey);
    map.set(key, entry);
  };

  let total = 0;
  const lines: SpendingReport["lines"] = [];
  for (const line of raw) {
    const ticket = tickets.get(line.ticket_id) ?? null;
    const pStart = periodStart(line.purchased_on, granularity);
    const period = periods.get(pStart);
    if (period) {
      period.amount += line.line_total;
      period.purchases += 1;
      period.ticketIds.add(line.ticket_id);
    }
    total += line.line_total;
    add(departments, ticket?.assigned_to ?? "Unknown", ticket?.assigned_to ?? "Unknown", line.line_total, line.ticket_id);
    // Grouped case-insensitively so "PVC pipe" and "pvc pipe" are one item;
    // counted per purchase line, not per ticket.
    add(items, line.item.trim().toLowerCase(), line.item.trim(), line.line_total, line.id);
    add(areas, (ticket?.area ?? "Unknown").trim().toLowerCase(), ticket?.area ?? "Unknown", line.line_total, line.ticket_id);
    lines.push({ ...line, ticket, period: periodLabel(pStart, granularity) });
  }

  const ticketCount = new Set(raw.map((l) => l.ticket_id)).size;
  return {
    granularity,
    from,
    to,
    total: round2(total),
    purchaseCount: raw.length,
    ticketCount,
    averagePerTicket: ticketCount ? round2(total / ticketCount) : 0,
    periods: [...periods.values()].map(({ ticketIds, ...p }) => ({ ...p, amount: round2(p.amount), tickets: ticketIds.size })),
    byDepartment: rank(departments),
    topItems: rank(items, 10),
    topAreas: rank(areas, 10),
    lines,
  };
}

export type SpendingExport = "summary" | "itemized";

// Amounts go into the CSV as plain numbers (no ₦, no thousands separators)
// so Excel treats them as numbers that can be summed and charted.
const money = (n: number) => n.toFixed(2);

export async function buildSpendingCsv(kind: SpendingExport, granularity: Granularity, from: string, to: string): Promise<{ csv: string; filename: string }> {
  const report = await buildSpendingReport(granularity, from, to);
  const rangeStamp = `${from}-to-${to}`;

  if (kind === "summary") {
    const rows = report.periods.map((p) => ({
      period: p.label,
      start: p.start,
      end: p.end,
      amount: money(p.amount),
      purchases: p.purchases,
      tickets: p.tickets,
    }));
    rows.push({ period: "TOTAL", start: from, end: to, amount: money(report.total), purchases: report.purchaseCount, tickets: report.ticketCount });
    const csv = toCsv(rows, [
      { key: "period", label: granularity === "weekly" ? "Week" : granularity === "monthly" ? "Month" : "Year" },
      { key: "start", label: "From" },
      { key: "end", label: "To" },
      { key: "amount", label: "Amount Spent (NGN)" },
      { key: "purchases", label: "Items Bought" },
      { key: "tickets", label: "Tickets" },
    ]);
    return { csv, filename: `maintenance-spending-${granularity}-${rangeStamp}.csv` };
  }

  const rows: Array<Record<string, string | number>> = report.lines.map((l) => ({
    purchased_on: l.purchased_on,
    period: l.period,
    area: l.ticket?.area ?? "",
    issue: l.ticket?.issue_type ?? "",
    department: l.ticket?.assigned_to ?? "",
    item: l.item,
    quantity: l.quantity,
    unit_cost: money(l.unit_cost),
    line_total: money(l.line_total),
    supplier: l.supplier ?? "",
    recorded_by: l.recorded_by_name,
  }));
  rows.push({
    purchased_on: "", period: "", area: "", issue: "", department: "", item: "TOTAL",
    quantity: "", unit_cost: "", line_total: money(report.total), supplier: "", recorded_by: "",
  });
  const csv = toCsv(rows, [
    { key: "purchased_on", label: "Purchase Date" },
    { key: "period", label: "Period" },
    { key: "area", label: "Area / Location" },
    { key: "issue", label: "Issue" },
    { key: "department", label: "Department" },
    { key: "item", label: "Item Bought" },
    { key: "quantity", label: "Quantity" },
    { key: "unit_cost", label: "Unit Cost (NGN)" },
    { key: "line_total", label: "Line Total (NGN)" },
    { key: "supplier", label: "Supplier" },
    { key: "recorded_by", label: "Recorded By" },
  ]);
  return { csv, filename: `maintenance-purchases-${rangeStamp}.csv` };
}
