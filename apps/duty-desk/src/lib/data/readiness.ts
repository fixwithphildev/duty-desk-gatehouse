import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { APARTMENTS, aptKey, findApartment, type Apartment } from "@/lib/apartments";
import { getChecklistsInProgress, type InProgressChecklist } from "@/lib/data/checklists";

// Whether front desk can sell an apartment, worked out from the checklists:
//  - Inspecting: a check-in prep is in progress right now.
//  - Ready to sell: the latest check-in prep was submitted Ready less than READY_DAYS ago.
//  - Re-check due: it was Ready, but that was READY_DAYS or more ago and it still hasn't sold.
//  - Not ready: the latest check-in prep was submitted Not ready. It stays red until a new
//    check-in prep says Ready, even once the repairs are done.
//  - Needs checklist: never inspected, or a guest has checked out since the last check-in prep.
//  - Occupied: a guest's check-in was recorded and their check-out hasn't been yet.
// Only check-in preps decide Ready. A recorded check-out (or a check-out inspection) marks the
// guest as gone, so the apartment then needs a new check-in prep.
export type ReadyStatus = "ready" | "recheck" | "notready" | "inspecting" | "unchecked" | "occupied";
export const READY_DAYS = 3;
export const STATUS_LABEL: Record<ReadyStatus, string> = {
  ready: "Ready to sell",
  recheck: "Re-check due",
  notready: "Not ready",
  inspecting: "Inspecting",
  unchecked: "Needs checklist",
  occupied: "Occupied",
};

export interface Flag {
  item: string;
  problem: string; // "Damaged", "Missing"
  ticketId: string | null;
  ticketStatus: string | null;
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
  flags: Flag[];
}

const DAY = 24 * 60 * 60 * 1000;

// Wrapped in cache() so the menu and the page share one lookup per request.
export const getReadiness = cache(async function getReadiness(): Promise<Readiness[]> {
  const [{ data: rows, error }, drafts, { data: blocking }, { data: stays }] = await Promise.all([
    supabaseAdmin
      .from("apartment_checklists")
      .select("id, apartment, type, overall_ready, created_at, staff_accounts!apartment_checklists_prepared_by_fkey(display_name)")
      .eq("status", "submitted")
      .eq("void", false)
      .order("created_at", { ascending: false }),
    getChecklistsInProgress(),
    // Problems reported on an apartment that stop it being sold.
    supabaseAdmin.from("maintenance_tickets").select("id, area, issue_type, status, created_at").eq("blocks_sale", true).eq("void", false),
    // Guests staying now, and check-outs in the last 90 days.
    supabaseAdmin
      .from("resident_profiles")
      .select("id, name, room, check_out, checked_in_at, checked_out_at")
      .not("checked_in_at", "is", null)
      .eq("void", false)
      .or(`checked_out_at.is.null,checked_out_at.gte.${new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10)}`),
  ]);
  if (error) throw new Error(error.message);
  const blocksBy = new Map<string, { id: string; issue: string; status: string; at: string }[]>();
  for (const t of blocking ?? []) {
    const a = findApartment(String(t.area).replace(/^apartment\s+/i, ""));
    if (!a) continue;
    const k = aptKey(a.name);
    blocksBy.set(k, [...(blocksBy.get(k) ?? []), { id: t.id, issue: t.issue_type, status: t.status, at: t.created_at }]);
  }

  const prep = new Map<string, Readiness["lastPrep"]>();
  const out = new Map<string, Readiness["lastCheckout"]>();
  for (const r of (rows ?? []) as unknown as Array<Record<string, unknown>>) {
    const a = findApartment(r.apartment as string);
    if (!a) continue;
    const k = aptKey(a.name), by = (r.staff_accounts as { display_name?: string } | null)?.display_name ?? "—";
    if (r.type === "check_in_prep" && !prep.has(k)) prep.set(k, { id: r.id as string, ready: r.overall_ready as boolean, at: r.created_at as string, by });
    if (r.type === "check_out_inspection" && !out.has(k)) out.set(k, { at: r.created_at as string, by });
  }
  // The latest recorded check-out counts like a check-out inspection: the apartment needs a new prep.
  const stayBy = new Map<string, Stay>();
  for (const s of stays ?? []) {
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

  // What was flagged on the latest Not ready check-in preps, and where those repairs stand.
  const notReadyIds = [...prep.values()].filter((p) => p && !p.ready).map((p) => p!.id);
  const flagsBy = new Map<string, Flag[]>();
  if (notReadyIds.length) {
    const { data: items } = await supabaseAdmin
      .from("checklist_items")
      .select("checklist_id, name, condition, available, linked_ticket_id")
      .in("checklist_id", notReadyIds)
      .or("condition.in.(Damaged,Missing),available.eq.No");
    const ticketIds = (items ?? []).map((i) => i.linked_ticket_id).filter(Boolean) as string[];
    const status = new Map<string, string>();
    if (ticketIds.length) {
      const { data: tickets } = await supabaseAdmin.from("maintenance_tickets").select("id, status").in("id", ticketIds);
      for (const t of tickets ?? []) status.set(t.id, t.status);
    }
    for (const i of items ?? []) {
      const list = flagsBy.get(i.checklist_id) ?? [];
      list.push({ item: i.name, problem: i.condition ?? "Missing", ticketId: i.linked_ticket_id, ticketStatus: i.linked_ticket_id ? status.get(i.linked_ticket_id) ?? null : null });
      flagsBy.set(i.checklist_id, list);
    }
  }

  const now = Date.now();
  return APARTMENTS.map((apartment) => {
    const k = aptKey(apartment.name);
    const lastPrep = prep.get(k) ?? null, lastCheckout = out.get(k) ?? null, draft = draftBy.get(k) ?? null;
    // A check-out since the guest checked in means they've gone, even if nobody recorded it here.
    const stay = stayBy.get(k) && !(lastCheckout && lastCheckout.at > stayBy.get(k)!.since) ? stayBy.get(k)! : null;
    const prepCounts = !!lastPrep && (!lastCheckout || lastPrep.at > lastCheckout.at);
    // A reported problem since the last check-in prep keeps it off sale until it's checked again.
    const blocks = (blocksBy.get(k) ?? []).filter((b) => !lastPrep || b.at > lastPrep.at);
    let status: ReadyStatus = "unchecked", readyUntil: string | null = null, daysLeft: number | null = null;
    if (stay) status = "occupied";
    else if (draft) status = "inspecting";
    else if (blocks.length) status = "notready";
    else if (prepCounts && lastPrep?.ready) {
      const until = new Date(lastPrep!.at).getTime() + READY_DAYS * DAY;
      readyUntil = new Date(until).toISOString();
      if (until > now) { status = "ready"; daysLeft = Math.max(1, Math.ceil((until - now) / DAY)); }
      else status = "recheck";
    } else if (prepCounts) status = "notready";
    const flags: Flag[] = status !== "notready" ? [] : [
      ...(lastPrep && prepCounts && !lastPrep.ready ? flagsBy.get(lastPrep.id) ?? [] : []),
      ...blocks.map((b) => ({ item: b.issue, problem: "Reported", ticketId: b.id, ticketStatus: b.status })),
    ];
    return { apartment, status, stay, lastPrep, lastCheckout, draft, readyUntil, daysLeft, flags };
  });
});

export function countByStatus(list: Readiness[]): Record<ReadyStatus, number> {
  const c: Record<ReadyStatus, number> = { ready: 0, recheck: 0, notready: 0, inspecting: 0, unchecked: 0, occupied: 0 };
  for (const r of list) c[r.status]++;
  return c;
}

// Guests due to leave today (Lagos), by apartment name.
export function leavingToday(list: Readiness[]): Readiness[] {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  return list.filter((r) => r.stay?.until && r.stay.until <= today).sort((a, b) => a.apartment.name.localeCompare(b.apartment.name));
}

// Check-in preps waiting to be done: never inspected / checked out first, then re-checks.
export function todoList(list: Readiness[]): Readiness[] {
  return list.filter((r) => r.status === "unchecked" || r.status === "recheck").sort((a, b) => (a.status === "unchecked" ? 0 : 1) - (b.status === "unchecked" ? 0 : 1) || a.apartment.name.localeCompare(b.apartment.name));
}
