import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { ChecklistType, Condition } from "@/lib/types";

export interface ChecklistRow {
  id: string;
  apartment: string;
  type: ChecklistType;
  prepared_by: string;
  prepared_by_name: string;
  status: string;
  overall_ready: boolean;
  created_at: string;
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
  const { data } = await supabaseAdmin
    .from("apartment_checklists")
    .select("id, apartment, type, prepared_by, status, overall_ready, created_at, staff_accounts(display_name)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    apartment: row.apartment as string,
    type: row.type as ChecklistType,
    prepared_by: row.prepared_by as string,
    status: row.status as string,
    overall_ready: row.overall_ready as boolean,
    created_at: row.created_at as string,
    prepared_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
  }));
}

// The apartment's Ready/Not-Ready status is always derived from its most
// recent Submitted checklist — this is the hard-block source of truth for
// the front-desk gate lookup (blueprint 1.3/1.5), no manual override.
export async function getLatestSubmittedByApartment(): Promise<ChecklistRow[]> {
  const all = await getAllChecklists();
  const map = new Map<string, ChecklistRow>();
  for (const c of all) {
    if (c.status !== "submitted") continue;
    const key = c.apartment.trim().toLowerCase();
    if (!map.has(key)) map.set(key, c);
  }
  return [...map.values()];
}

export async function getChecklistWithItems(id: string): Promise<{ checklist: ChecklistRow; items: ChecklistItemRow[] } | null> {
  const { data: checklist } = await supabaseAdmin
    .from("apartment_checklists")
    .select("id, apartment, type, prepared_by, status, overall_ready, created_at, staff_accounts(display_name)")
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
      prepared_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
    },
    items: (items ?? []) as ChecklistItemRow[],
  };
}
