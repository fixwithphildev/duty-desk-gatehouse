import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { getComplaints } from "@/lib/data/complaints";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { getAllChecklists } from "@/lib/data/checklists";
import { findApartment } from "@/lib/apartments";

// Everything the Reports & Analytics page shows, computed from live records.
// Voided records are excluded throughout. Days and hours are the property's
// (Lagos), not the server's — Vercel runs in UTC, which would put late-
// evening items on the wrong day and shift the busy-times heatmap by an hour.

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(raw: string | undefined): Period {
  const n = Number(raw);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

const TZ = "Africa/Lagos";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const lagosHour = (d: Date) => Number(d.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ })) % 24;
// Monday = 0 … Sunday = 6, in Lagos time.
const lagosWeekday = (d: Date) => (["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).indexOf(d.toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ }) as "Mon");

export const SERIES_KEYS = ["Complaints", "Maintenance", "Checklists"] as const;
export type SeriesKey = (typeof SERIES_KEYS)[number];

export interface Ranked {
  name: string;
  detail: string;
  value: number;
}

export interface Analytics {
  days: Period;
  dates: string[]; // YYYY-MM-DD, oldest first
  series: Record<SeriesKey, number[]>;
  totals: Record<SeriesKey, number>;
  previous: Record<SeriesKey, number>;
  ready: { ready: number; checked: number };
  categories: { name: string; value: number }[];
  status: { name: "Complaints" | "Maintenance"; open: number; progress: number; resolved: number }[];
  heat: number[][]; // [weekday 0-6][band 0-5]; bands of 4 hours from midnight
  rooms: Ranked[];
  flagged: Ranked[];
  // Check-in preps submitted each day of the period, Ready and Not ready.
  preps: { date: string; ready: number; not: number }[];
  // Who submitted the check-in preps in the period.
  officers: { name: string; value: number }[];
  // Repair tickets opened in the period: where they came from, and each department's open of total.
  sources: { name: string; value: number }[];
  depts: { name: string; open: number; total: number }[];
}

function lastNDays(n: number, end = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(end.getTime() - i * 86400000)));
  return out;
}

const tidy = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ");
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export async function buildAnalytics(days: Period): Promise<Analytics> {
  const [complaintsAll, ticketsAll, checklistsAll] = await Promise.all([getComplaints(), getMaintenanceTickets(), getAllChecklists()]);
  const complaints = complaintsAll.filter((c) => !c.void);
  const tickets = ticketsAll.filter((t) => !t.void);
  const checklists = checklistsAll.filter((c) => !c.void && c.status === "submitted");

  const dates = lastNDays(days);
  const prevDates = new Set(lastNDays(days, new Date(Date.now() - days * 86400000)));
  const inPeriod = new Set(dates);

  const byKey: Record<SeriesKey, { created_at: string }[]> = { Complaints: complaints, Maintenance: tickets, Checklists: checklists };
  const series = {} as Record<SeriesKey, number[]>;
  const totals = {} as Record<SeriesKey, number>;
  const previous = {} as Record<SeriesKey, number>;
  for (const key of SERIES_KEYS) {
    const counts = new Map(dates.map((d) => [d, 0]));
    let prev = 0;
    for (const row of byKey[key]) {
      const k = dayKey(new Date(row.created_at));
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
      else if (prevDates.has(k)) prev += 1;
    }
    series[key] = dates.map((d) => counts.get(d) ?? 0);
    totals[key] = series[key].reduce((a, b) => a + b, 0);
    previous[key] = prev;
  }

  const periodComplaints = complaints.filter((c) => inPeriod.has(dayKey(new Date(c.created_at))));
  const periodTickets = tickets.filter((t) => inPeriod.has(dayKey(new Date(t.created_at))));
  const periodChecklists = checklists.filter((c) => inPeriod.has(dayKey(new Date(c.created_at))));

  // Readiness is "now", not per period: each apartment's latest submitted checklist.
  const latest = new Map<string, boolean>();
  for (const c of checklists) {
    const k = c.apartment.trim().toLowerCase();
    if (!latest.has(k)) latest.set(k, c.overall_ready); // getAllChecklists is newest-first
  }
  const ready = { ready: [...latest.values()].filter(Boolean).length, checked: latest.size };

  const catCounts = new Map<string, number>();
  for (const c of periodComplaints) catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);
  const categories = [...catCounts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const statusOf = (rows: { status: string }[], open: string) => ({
    open: rows.filter((r) => r.status === open).length,
    progress: rows.filter((r) => r.status === "In Progress").length,
    resolved: rows.filter((r) => r.status === "Resolved").length,
  });
  const status = [
    { name: "Complaints" as const, ...statusOf(periodComplaints, "Open") },
    { name: "Maintenance" as const, ...statusOf(periodTickets, "Reported") },
  ];

  const heat = Array.from({ length: 7 }, () => Array(6).fill(0) as number[]);
  for (const row of [...periodComplaints, ...periodTickets]) {
    const d = new Date(row.created_at);
    const wd = lagosWeekday(d);
    if (wd >= 0) heat[wd][Math.floor(lagosHour(d) / 4)] += 1;
  }

  // Rooms & areas: complaint rooms and ticket areas, grouped case-insensitively.
  const places = new Map<string, { name: string; complaints: number; tickets: number }>();
  const addPlace = (raw: string | null, kind: "complaints" | "tickets") => {
    // "Apartment Lisbon" (a ticket) and "Lisbon" (a complaint) are the same place.
    const name = findApartment(tidy(raw).replace(/^apartment\s+/i, ""))?.name ?? tidy(raw);
    if (!name) return;
    const key = name.toLowerCase();
    const entry = places.get(key) ?? { name: titleCase(name), complaints: 0, tickets: 0 };
    entry[kind] += 1;
    places.set(key, entry);
  };
  periodComplaints.forEach((c) => addPlace(c.room, "complaints"));
  periodTickets.forEach((t) => addPlace(t.area, "tickets"));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const rooms: Ranked[] = [...places.values()]
    .map((p) => ({ name: p.name, value: p.complaints + p.tickets, detail: [p.complaints ? plural(p.complaints, "complaint") : "", p.tickets ? plural(p.tickets, "ticket") : ""].filter(Boolean).join(", ") }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const flagged = await getFlaggedItems(periodChecklists.map((c) => c.id));

  const periodPreps = periodChecklists.filter((c) => c.type === "check_in_prep");
  const preps = dates.map((date) => {
    const day = periodPreps.filter((c) => dayKey(new Date(c.created_at)) === date);
    return { date, ready: day.filter((c) => c.overall_ready).length, not: day.filter((c) => !c.overall_ready).length };
  });
  const tally = (names: string[]) => {
    const m = new Map<string, number>();
    for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const officers = tally(periodPreps.map((c) => c.prepared_by_name || "—"));
  const SOURCE: Record<string, string> = { checklist: "Check-in prep", complaint: "Complaint", report: "Problem report", manual: "Logged by hand" };
  const sources = tally(periodTickets.map((t) => SOURCE[t.source] ?? "Maintenance Desk"));
  const depts = [...new Set(periodTickets.map((t) => t.assigned_to))]
    .map((name) => ({ name, open: periodTickets.filter((t) => t.assigned_to === name && t.status !== "Resolved").length, total: periodTickets.filter((t) => t.assigned_to === name).length }))
    .sort((a, b) => b.total - a.total);

  return { days, dates, series, totals, previous, ready, categories, status, heat, rooms, flagged, preps, officers, sources, depts };
}

// Checklist items marked Damaged or Missing (or a yes/no item marked "No")
// on checklists submitted in the period.
async function getFlaggedItems(checklistIds: string[]): Promise<Ranked[]> {
  if (checklistIds.length === 0) return [];
  const counts = new Map<string, { name: string; category: string; damaged: number; missing: number }>();
  for (let i = 0; i < checklistIds.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("checklist_items")
      .select("name, category, condition, available")
      .in("checklist_id", checklistIds.slice(i, i + 200))
      .or("condition.in.(Damaged,Missing),available.eq.No");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const key = `${row.category}|${row.name}`.toLowerCase();
      const entry = counts.get(key) ?? { name: row.name as string, category: row.category as string, damaged: 0, missing: 0 };
      if (row.condition === "Damaged") entry.damaged += 1;
      else entry.missing += 1; // "Missing", or a yes/no item marked "No"
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .map((e) => ({
      name: e.name,
      value: e.damaged + e.missing,
      detail: [titleCase(e.category.replace(/[_-]+/g, " ")), e.missing ? `${e.missing} missing` : "", e.damaged ? `${e.damaged} damaged` : ""].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}
