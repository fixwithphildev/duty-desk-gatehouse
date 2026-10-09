import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import type { ChecklistType, Condition } from "@/lib/types";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";
import { problemOf, type Issue } from "@/lib/checklist-history";
import { allRows } from "./pages";

export interface ChecklistRow {
  id: string;
  apartment: string;
  type: ChecklistType;
  prepared_by: string;
  prepared_by_name: string;
  status: string;
  overall_ready: boolean;
  created_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
  // Only set while a checklist is in progress: the officer's Ready / Not
  // Ready choice so far (null = not chosen yet).
  draft_ready?: boolean | null;
  started_at?: string | null;
  taken_over_from_name?: string | null;
  taken_over_at?: string | null;
}

export interface ChecklistItemRow {
  id: string;
  checklist_id: string;
  name: string;
  category: string;
  kind: string;
  qty: string | null;
  condition: Condition | null;
  available: string | null;
  linked_ticket_id: string | null;
  note?: string | null;
  ticket_dept?: string | null;
}

// Submitted checklists only. Inspections still in progress are a separate
// list (getChecklistsInProgress below) so they never count towards an
// apartment's Ready/Not Ready status, reports or exports.
export async function getAllChecklists(): Promise<ChecklistRow[]> {
  // Explicit FK names — apartment_checklists has foreign keys into
  // staff_accounts for prepared_by, voided_by and taken_over_from, so a bare
  // "staff_accounts(display_name)" is ambiguous to PostgREST.
  const rows = await allRows((from, to) =>
    supabaseAdmin
      .from("apartment_checklists")
      .select(
        "id, apartment, type, prepared_by, status, overall_ready, created_at, void, void_reason, voided_at, " +
          "staff_accounts!apartment_checklists_prepared_by_fkey(display_name), voider:staff_accounts!apartment_checklists_voided_by_fkey(display_name)"
      )
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
  );
  return rows.map((row) => ({
    id: row.id as string,
    apartment: row.apartment as string,
    type: row.type as ChecklistType,
    prepared_by: row.prepared_by as string,
    status: row.status as string,
    overall_ready: row.overall_ready as boolean,
    created_at: row.created_at as string,
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_at: row.voided_at as string | null,
    prepared_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
    voided_by_name: (row.voider as { display_name?: string } | null)?.display_name ?? null,
  }));
}

// What was wrong on each checklist: every Damaged, Missing or Not available
// line, with the officer's note and the ticket it opened. Keyed by checklist id.
export async function getChecklistIssues(): Promise<Map<string, Issue[]>> {
  const rows = await allRows((from, to) =>
    supabaseAdmin
      .from("checklist_items")
      .select("id, checklist_id, name, condition, available, note, linked_ticket_id")
      .or("condition.in.(Damaged,Missing),available.eq.No")
      .order("id")
      .range(from, to)
  );
  const by = new Map<string, Issue[]>();
  for (const r of rows) {
    const problem = problemOf({ condition: r.condition as string | null, available: r.available as string | null });
    if (!problem) continue;
    const list = by.get(r.checklist_id as string) ?? [];
    list.push({ name: r.name as string, problem, note: (r.note as string | null)?.trim() || null, ticketId: (r.linked_ticket_id as string | null) ?? null });
    by.set(r.checklist_id as string, list);
  }
  return by;
}

// The apartment's Ready/Not-Ready status is always derived from its most
// recent Submitted checklist — this is the hard-block source of truth for
// the front-desk gate lookup (blueprint 1.3/1.5), no manual override. A
// voided checklist is skipped entirely, same as if it had never been
// submitted — the next most recent submitted one becomes authoritative.
export async function getLatestSubmittedByApartment(): Promise<ChecklistRow[]> {
  const all = await getAllChecklists();
  const map = new Map<string, ChecklistRow>();
  for (const c of all) {
    if (c.status !== "submitted" || c.void) continue;
    const key = c.apartment.trim().toLowerCase();
    if (!map.has(key)) map.set(key, c);
  }
  return [...map.values()];
}

export async function getChecklistsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await supabaseAdmin
    .from("apartment_checklists")
    .select("created_at")
    .eq("status", "submitted")
    .gte("created_at", daysAgoIso(days));
  return bucketByDay((data ?? []).map((r) => r.created_at), days);
}

// Lightweight, cached version of "how many apartments are currently Not
// Ready" for the sidebar badge — this runs on EVERY page load site-wide
// (it lives in the shared app layout), so unlike getAllChecklists() it
// selects only the 3 columns it needs (no staff_accounts join) and is
// cached for 30s instead of hitting the database on every navigation.
// Checklist submission explicitly busts this cache via revalidateTag, so
// it's never stale for more than a moment after a real change.
export const getNotReadyCount = unstable_cache(
  async (): Promise<number> => {
    const { data } = await supabaseAdmin
      .from("apartment_checklists")
      .select("apartment, overall_ready, created_at")
      .eq("status", "submitted")
      .eq("void", false)
      .order("created_at", { ascending: false });

    const latestByApartment = new Map<string, boolean>();
    for (const row of data ?? []) {
      const key = row.apartment.trim().toLowerCase();
      if (!latestByApartment.has(key)) latestByApartment.set(key, row.overall_ready);
    }
    return [...latestByApartment.values()].filter((ready) => !ready).length;
  },
  ["checklists-not-ready-count"],
  { revalidate: 30, tags: ["checklists"] }
);

export interface InProgressChecklist {
  id: string;
  apartment: string;
  type: ChecklistType;
  prepared_by: string;
  prepared_by_name: string;
  started_at: string;
  updated_at: string;
  answered: number;
  taken_over_from_name: string | null;
  taken_over_at: string | null;
}

const IN_PROGRESS_COLUMNS =
  "id, apartment, type, prepared_by, created_at, started_at, updated_at, taken_over_at, " +
  "staff_accounts!apartment_checklists_prepared_by_fkey(display_name), " +
  "previous:staff_accounts!apartment_checklists_taken_over_from_fkey(display_name)";

async function toInProgress(rows: Array<Record<string, unknown>>): Promise<InProgressChecklist[]> {
  if (rows.length === 0) return [];
  const { data: items } = await supabaseAdmin
    .from("checklist_items")
    .select("checklist_id, condition, available")
    .in("checklist_id", rows.map((r) => r.id as string));
  const answered = new Map<string, number>();
  for (const item of items ?? []) {
    if (item.condition || item.available) answered.set(item.checklist_id, (answered.get(item.checklist_id) ?? 0) + 1);
  }
  return rows.map((row) => ({
    id: row.id as string,
    apartment: row.apartment as string,
    type: row.type as ChecklistType,
    prepared_by: row.prepared_by as string,
    prepared_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
    started_at: (row.started_at as string | null) ?? (row.created_at as string),
    updated_at: row.updated_at as string,
    answered: answered.get(row.id as string) ?? 0,
    taken_over_from_name: (row.previous as { display_name?: string } | null)?.display_name ?? null,
    taken_over_at: row.taken_over_at as string | null,
  }));
}

// Inspections an officer has started but not submitted yet. Every answer is
// saved as they go, so this is what tells everyone else "Apartment 12B is
// being inspected by Adaeze, started 09:05, 42 of 84 done".
export async function getChecklistsInProgress(): Promise<InProgressChecklist[]> {
  const { data, error } = await supabaseAdmin
    .from("apartment_checklists")
    .select(IN_PROGRESS_COLUMNS)
    .eq("status", "in_progress")
    .eq("void", false)
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return toInProgress((data ?? []) as unknown as Array<Record<string, unknown>>);
}

export async function getChecklistInProgressForApartment(apartment: string): Promise<InProgressChecklist | null> {
  const { data } = await supabaseAdmin
    .from("apartment_checklists")
    .select(IN_PROGRESS_COLUMNS)
    .eq("status", "in_progress")
    .eq("void", false)
    .ilike("apartment", apartment.trim().replace(/[%_\\]/g, (c) => "\\" + c));
  const [row] = await toInProgress((data ?? []) as unknown as Array<Record<string, unknown>>);
  return row ?? null;
}

export async function getChecklistInProgressById(id: string): Promise<InProgressChecklist | null> {
  const { data } = await supabaseAdmin
    .from("apartment_checklists")
    .select(IN_PROGRESS_COLUMNS)
    .eq("id", id)
    .eq("status", "in_progress")
    .eq("void", false)
    .maybeSingle();
  if (!data) return null;
  const [row] = await toInProgress([data as unknown as Record<string, unknown>]);
  return row ?? null;
}

export async function getChecklistWithItems(id: string): Promise<{ checklist: ChecklistRow; items: ChecklistItemRow[] } | null> {
  const { data: checklist } = await supabaseAdmin
    .from("apartment_checklists")
    .select(
      "id, apartment, type, prepared_by, status, overall_ready, created_at, void, void_reason, voided_at, draft_ready, started_at, taken_over_at, " +
        "staff_accounts!apartment_checklists_prepared_by_fkey(display_name), voider:staff_accounts!apartment_checklists_voided_by_fkey(display_name), " +
        "previous:staff_accounts!apartment_checklists_taken_over_from_fkey(display_name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!checklist) return null;
  const row = checklist as unknown as Record<string, unknown>;
  const { data: items } = await supabaseAdmin.from("checklist_items").select("*").eq("checklist_id", id);
  return {
    checklist: {
      id: row.id as string,
      apartment: row.apartment as string,
      type: row.type as ChecklistType,
      prepared_by: row.prepared_by as string,
      status: row.status as string,
      overall_ready: row.overall_ready as boolean,
      created_at: row.created_at as string,
      void: row.void as boolean,
      void_reason: row.void_reason as string | null,
      voided_at: row.voided_at as string | null,
      prepared_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
      voided_by_name: (row.voider as { display_name?: string } | null)?.display_name ?? null,
      draft_ready: (row.draft_ready as boolean | null) ?? null,
      started_at: (row.started_at as string | null) ?? null,
      taken_over_from_name: (row.previous as { display_name?: string } | null)?.display_name ?? null,
      taken_over_at: (row.taken_over_at as string | null) ?? null,
    },
    items: (items ?? []) as ChecklistItemRow[],
  };
}
