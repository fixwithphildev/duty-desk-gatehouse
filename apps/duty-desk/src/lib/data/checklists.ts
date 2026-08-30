import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import type { ChecklistType, Condition } from "@/lib/types";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";

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
}

export async function getAllChecklists(): Promise<ChecklistRow[]> {
  // Explicit FK names — apartment_checklists has two foreign keys into
  // staff_accounts (prepared_by and voided_by), so a bare
  // "staff_accounts(display_name)" is ambiguous to PostgREST.
  const { data, error } = await supabaseAdmin
    .from("apartment_checklists")
    .select(
      "id, apartment, type, prepared_by, status, overall_ready, created_at, void, void_reason, voided_at, " +
        "staff_accounts!apartment_checklists_prepared_by_fkey(display_name), voider:staff_accounts!apartment_checklists_voided_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
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

export async function getChecklistWithItems(id: string): Promise<{ checklist: ChecklistRow; items: ChecklistItemRow[] } | null> {
  const { data: checklist } = await supabaseAdmin
    .from("apartment_checklists")
    .select(
      "id, apartment, type, prepared_by, status, overall_ready, created_at, void, void_reason, voided_at, " +
        "staff_accounts!apartment_checklists_prepared_by_fkey(display_name), voider:staff_accounts!apartment_checklists_voided_by_fkey(display_name)"
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
    },
    items: (items ?? []) as ChecklistItemRow[],
  };
}
