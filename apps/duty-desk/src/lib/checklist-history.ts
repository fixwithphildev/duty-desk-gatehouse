// The record of submitted checklists: what was wrong on each one, and the
// filters the Checklists page and its export share (so "Export these" gives
// exactly the rows on screen).

export type Problem = "Damaged" | "Missing" | "Not available";

// Damaged, Missing, or a "No" on a yes/no line. Anything else isn't an issue.
export function problemOf(i: { condition: string | null; available: string | null }): Problem | null {
  if (i.condition === "Damaged" || i.condition === "Missing") return i.condition;
  if (i.available === "No") return "Not available";
  return null;
}

export interface Issue {
  name: string;
  problem: Problem;
  note: string | null;
  ticketId: string | null;
}

export type HistoryType = "all" | "in" | "out";

export interface HistoryFilter {
  q: string;
  type: HistoryType;
  issues: boolean;
  // Lagos dates, YYYY-MM-DD, both ends included. Empty = no limit.
  from: string;
  to: string;
}

export const NO_FILTER: HistoryFilter = { q: "", type: "all", issues: false, from: "", to: "" };

export interface Filterable {
  apartment: string;
  by: string;
  typeKey: "in" | "out";
  day: string;
  issues: Issue[];
}

export function matchesHistory(r: Filterable, f: HistoryFilter): boolean {
  if (f.type !== "all" && r.typeKey !== f.type) return false;
  if (f.issues && r.issues.length === 0) return false;
  if (f.from && r.day < f.from) return false;
  if (f.to && r.day > f.to) return false;
  const s = f.q.trim().toLowerCase();
  if (!s) return true;
  // The search also finds the flagged item or the officer's note ("fridge", "leaking").
  return `${r.apartment} ${r.by} ${r.issues.map((i) => `${i.name} ${i.note ?? ""}`).join(" ")}`.toLowerCase().includes(s);
}

const isDay = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function filterFromParams(p: Record<string, string | undefined>): HistoryFilter {
  return {
    q: (p.q ?? p.apt ?? "").slice(0, 100),
    type: p.type === "in" || p.type === "out" ? p.type : "all",
    issues: p.issues === "1",
    from: isDay(p.from),
    to: isDay(p.to),
  };
}

export function filterToQuery(f: HistoryFilter): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.type !== "all") p.set("type", f.type);
  if (f.issues) p.set("issues", "1");
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const isFiltered = (f: HistoryFilter) => !!(f.q.trim() || f.type !== "all" || f.issues || f.from || f.to);
