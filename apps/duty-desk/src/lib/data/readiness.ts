import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { APARTMENTS, aptKey, findApartment, type Apartment } from "@/lib/apartments";
import { getChecklistsInProgress, type InProgressChecklist } from "@/lib/data/checklists";
import { isTodo, todoRank, type ReadyStatus } from "@/lib/status";
import { whenText } from "@/lib/time";

export { STATUS_LABEL, type ReadyStatus } from "@/lib/status";

// Whether front desk can sell an apartment, worked out from the checklists and repairs:
//  - Inspecting: a check-in prep is in progress right now.
//  - Ready to sell: the latest check-in prep was submitted Ready less than READY_DAYS ago.
//  - Re-check due: it was Ready, but that was READY_DAYS or more ago and it still hasn't sold.
//  - Under maintenance: a repair stopping its sale is still open. Those are problems an
//    officer put it under maintenance for since its last Ready check-in prep, and the items
//    flagged on its latest check-in prep when that one was Not ready.
//  - Repairs done: every one of those repairs is fixed. It needs a new check-in prep.
//  - Not ready: the latest check-in prep was Not ready with no repair to wait for.
//  - Needs checklist: never inspected, or a guest has checked out since the last check-in prep.
//  - Occupied: a guest's check-in was recorded and their check-out hasn't been yet.
// Only a Ready check-in prep makes it sellable again: the officer decides, never the repairs.
// A recorded check-out (or a check-out inspection) marks the guest as gone, so the apartment
// then needs a new check-in prep.
export const READY_DAYS = 3;

export interface RepairTicket {
  id: string;
  ref: string | null; // MT-0042
  team: string;
  status: "Reported" | "In Progress" | "Resolved";
  startedBy: string | null;
  fixedBy: string | null;
  fixedAt: string | null;
}

// One reason an apartment can't be sold, with who gave it and where its repair stands.
export interface Reason {
  item: string;
  problem: string; // "Reported" (put under maintenance), or "Damaged", "Missing", "Not available" (check-in prep)
  note: string | null;
  from: "report" | "prep";
  by: string;
  at: string;
  prepId: string | null;
  ticket: RepairTicket | null;
}

export interface Stay {
  id: string;
  guest: string;
  since: string; // checked in at
  until: string | null; // planned check-out date, "2026-10-09"
}

export interface Readiness {
  apartment: Apartment;
  status: ReadyStatus;
  stay: Stay | null;
  lastPrep: { id: string; ready: boolean; at: string; by: string } | null;
  lastCheckout: { at: string; by: string } | null;
  draft: InProgressChecklist | null;
  readyUntil: string | null;
  daysLeft: number | null;
  // Newest first. Empty unless something is reported or flagged that a Ready check-in prep hasn't cleared.
  reasons: Reason[];
}

const DAY = 24 * 60 * 60 * 1000;
const isOpen = (r: Reason) => !!r.ticket && r.ticket.status !== "Resolved";
const ref = (n: unknown) => (n ? `MT-${String(n).padStart(4, "0")}` : null);
const name = (x: unknown) => (x as { display_name?: string } | null)?.display_name ?? null;
const toTicket = (t: Record<string, unknown>): RepairTicket => ({
  id: t.id as string,
  ref: ref(t.ref_no),
  team: t.assigned_to as string,
  status: t.status as RepairTicket["status"],
  startedBy: (t.started_by_name as string | null) ?? null,
  fixedBy: (t.resolved_by_name as string | null) ?? null,
  fixedAt: (t.resolved_at as string | null) ?? null,
});
const TICKET_COLUMNS = "id, ref_no, assigned_to, status, started_by_name, resolved_by_name, resolved_at";

// Wrapped in cache() so the menu and the page share one lookup per request.
export const getReadiness = cache(async function getReadiness(): Promise<Readiness[]> {
  const [latest, drafts, stays] = await Promise.all([
    // Each apartment's latest Ready and Not ready checklist of each type (migration 0012), not every
    // checklist ever submitted, so this stays the same size however many records pile up.
    supabaseAdmin.from("apartment_latest_checklists").select("id, apartment, type, overall_ready, created_at, prepared_by_name").order("created_at", { ascending: false }),
    getChecklistsInProgress(),
    // Guests staying now, and check-outs in the last 90 days.
    supabaseAdmin
      .from("resident_profiles")
      .select("id, name, room, check_out, checked_in_at, checked_out_at")
      .not("checked_in_at", "is", null)
      .eq("void", false)
      .or(`checked_out_at.is.null,checked_out_at.gte.${new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10)}`),
  ]);
  if (latest.error) throw new Error(latest.error.message);
  if (stays.error) throw new Error(stays.error.message);

  const prep = new Map<string, Readiness["lastPrep"]>();
  const readyAt = new Map<string, string>(); // the latest Ready check-in prep
  const out = new Map<string, Readiness["lastCheckout"]>();
  for (const r of latest.data ?? []) {
    const a = findApartment(r.apartment as string);
    if (!a) continue;
    const k = aptKey(a.name), by = (r.prepared_by_name as string | null) ?? "—";
    if (r.type === "check_in_prep") {
      if (!prep.has(k)) prep.set(k, { id: r.id as string, ready: r.overall_ready as boolean, at: r.created_at as string, by });
      if (r.overall_ready && !readyAt.has(k)) readyAt.set(k, r.created_at as string);
    }
    if (r.type === "check_out_inspection" && !out.has(k)) out.set(k, { at: r.created_at as string, by });
  }
  // The latest recorded check-out counts like a check-out inspection: the apartment needs a new prep.
  const stayBy = new Map<string, Stay>();
  for (const s of stays.data ?? []) {
    const a = findApartment(s.room as string);
    if (!a) continue;
    const k = aptKey(a.name);
    if (s.checked_out_at) {
      const o = out.get(k);
      if (!o || s.checked_out_at > o.at) out.set(k, { at: s.checked_out_at as string, by: s.name as string });
    } else {
      const cur = stayBy.get(k);
      if (!cur || (s.checked_in_at as string) > cur.since) stayBy.set(k, { id: s.id as string, guest: s.name as string, since: s.checked_in_at as string, until: (s.check_out as string | null) ?? null });
    }
  }
  const draftBy = new Map<string, InProgressChecklist>();
  for (const d of drafts) { const a = findApartment(d.apartment); if (a) draftBy.set(aptKey(a.name), d); }
  // A check-in prep only counts if no guest has checked out since.
  const counts = (k: string) => { const p = prep.get(k), o = out.get(k); return !!p && (!o || p.at > o.at); };

  // Problems an officer put an apartment under maintenance for stop it selling until a Ready
  // check-in prep after them. Open ones always count. A fixed one only matters until the next
  // Ready prep, so fixed ones older than every apartment's last Ready prep aren't read (an
  // apartment never Ready since then still needs a check-in prep, it just isn't called repaired).
  const readyAts = APARTMENTS.map((a) => readyAt.get(aptKey(a.name))).filter(Boolean) as string[];
  const oldestReady = readyAts.length ? readyAts.reduce((x, y) => (x < y ? x : y)) : null;
  let reportQuery = supabaseAdmin
    .from("maintenance_tickets")
    .select(`${TICKET_COLUMNS}, area, issue_type, notes, created_at, creator:staff_accounts!maintenance_tickets_created_by_fkey(display_name)`)
    .eq("blocks_sale", true)
    .eq("void", false);
  if (oldestReady) reportQuery = reportQuery.or(`status.neq.Resolved,created_at.gt."${oldestReady}"`);
  // What was flagged on the latest check-in preps that were Not ready, and where each repair stands.
  const notReadyIds = [...prep.entries()].filter(([k, p]) => p && !p.ready && counts(k)).map(([, p]) => p!.id);
  const [reports, items] = await Promise.all([
    reportQuery,
    notReadyIds.length
      ? supabaseAdmin
          .from("checklist_items")
          .select(`checklist_id, name, condition, available, note, ticket:maintenance_tickets!checklist_items_linked_ticket_fk(${TICKET_COLUMNS}, void)`)
          .in("checklist_id", notReadyIds)
          .or("condition.in.(Damaged,Missing),available.eq.No")
      : null,
  ]);
  if (reports.error) throw new Error(reports.error.message);
  if (items?.error) throw new Error(items.error.message);

  const reportsBy = new Map<string, Reason[]>();
  for (const t of (reports.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const a = findApartment(String(t.area).replace(/^apartment\s+/i, ""));
    if (!a) continue;
    const k = aptKey(a.name);
    const reason: Reason = { item: t.issue_type as string, problem: "Reported", note: (t.notes as string | null)?.trim() || null, from: "report", by: name(t.creator) ?? "—", at: t.created_at as string, prepId: null, ticket: toTicket(t) };
    reportsBy.set(k, [...(reportsBy.get(k) ?? []), reason]);
  }
  const flaggedBy = new Map<string, Omit<Reason, "by" | "at">[]>();
  for (const i of (items?.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const t = i.ticket as Record<string, unknown> | null;
    if (t?.void) continue; // the ticket was a mistake
    const list = flaggedBy.get(i.checklist_id as string) ?? [];
    list.push({ item: i.name as string, problem: (i.condition as string | null) ?? "Not available", note: (i.note as string | null)?.trim() || null, from: "prep", prepId: i.checklist_id as string, ticket: t ? toTicket(t) : null });
    flaggedBy.set(i.checklist_id as string, list);
  }

  const now = Date.now();
  return APARTMENTS.map((apartment) => {
    const k = aptKey(apartment.name);
    const lastPrep = prep.get(k) ?? null, lastCheckout = out.get(k) ?? null, draft = draftBy.get(k) ?? null, prepCounts = counts(k);
    // A check-out since the guest checked in means they've gone, even if nobody recorded it here.
    const stay = stayBy.get(k) && !(lastCheckout && lastCheckout.at > stayBy.get(k)!.since) ? stayBy.get(k)! : null;
    const since = readyAt.get(k);
    const reasons: Reason[] = [
      ...(reportsBy.get(k) ?? []).filter((r) => !since || r.at > since),
      ...(lastPrep && prepCounts && !lastPrep.ready ? (flaggedBy.get(lastPrep.id) ?? []).map((r) => ({ ...r, by: lastPrep.by, at: lastPrep.at })) : []),
    ].sort((x, y) => y.at.localeCompare(x.at));

    let status: ReadyStatus = "unchecked", readyUntil: string | null = null, daysLeft: number | null = null;
    if (stay) status = "occupied";
    else if (draft) status = "inspecting";
    else if (reasons.some(isOpen)) status = "maintenance";
    else if (reasons.some((r) => r.ticket)) status = "repaired";
    else if (prepCounts && lastPrep?.ready) {
      const until = new Date(lastPrep!.at).getTime() + READY_DAYS * DAY;
      readyUntil = new Date(until).toISOString();
      if (until > now) { status = "ready"; daysLeft = Math.max(1, Math.ceil((until - now) / DAY)); }
      else status = "recheck";
    } else if (prepCounts) status = "notready";
    return { apartment, status, stay, lastPrep, lastCheckout, draft, readyUntil, daysLeft, reasons };
  });
});

export const openReasons = (r: Readiness) => r.reasons.filter(isOpen);

export function countByStatus(list: Readiness[]): Record<ReadyStatus, number> {
  const c: Record<ReadyStatus, number> = { ready: 0, recheck: 0, maintenance: 0, repaired: 0, notready: 0, inspecting: 0, unchecked: 0, occupied: 0 };
  for (const r of list) c[r.status]++;
  return c;
}

// Guests due to leave today (Lagos), by apartment name.
export function leavingToday(list: Readiness[]): Readiness[] {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  return list.filter((r) => r.stay?.until && r.stay.until <= today).sort((a, b) => a.apartment.name.localeCompare(b.apartment.name));
}

// Check-in preps waiting to be done, repaired apartments first.
export function todoList(list: Readiness[]): Readiness[] {
  return list.filter((r) => isTodo(r.status)).sort((a, b) => todoRank(a.status) - todoRank(b.status) || a.apartment.name.localeCompare(b.apartment.name));
}

// Why an apartment on the to-do list needs a check-in prep, in a few words.
export function todoNote(r: Readiness): string {
  if (r.status === "repaired") return "Repairs done, check it again";
  if (r.status === "recheck") return "Ready check expired, still unsold";
  if (r.status === "notready") return r.lastPrep ? `Not ready since ${whenText(r.lastPrep.at)}` : "Not ready";
  return r.lastCheckout ? `Guest checked out ${whenText(r.lastCheckout.at)}` : "No check-in prep yet";
}
