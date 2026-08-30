import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { Severity } from "@/lib/types";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";

export interface IncidentRow {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  location: string | null;
  description: string | null;
  reported_by_name: string;
  status: "Open" | "In Progress" | "Resolved";
  created_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getIncidents(): Promise<IncidentRow[]> {
  // Explicit FK names on both joins — incidents has two foreign keys into
  // staff_accounts (reported_by and voided_by), so PostgREST can't infer
  // which one a bare "staff_accounts(display_name)" means and errors with
  // PGRST201 ("more than one relationship found") if left ambiguous.
  const { data, error } = await supabaseAdmin
    .from("incidents")
    .select(
      "id, title, category, severity, location, description, status, created_at, void, void_reason, voided_at, " +
        "staff_accounts!incidents_reported_by_fkey(display_name), voider:staff_accounts!incidents_voided_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    category: row.category as string,
    severity: row.severity as Severity,
    location: row.location as string | null,
    description: row.description as string | null,
    status: row.status as IncidentRow["status"],
    created_at: row.created_at as string,
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_at: row.voided_at as string | null,
    reported_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
    voided_by_name: (row.voider as { display_name?: string } | null)?.display_name ?? null,
  }));
}

export async function getOpenIncidentsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("incidents").select("id", { count: "exact", head: true }).neq("status", "Resolved");
  return count ?? 0;
}

export async function getIncidentsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await supabaseAdmin.from("incidents").select("created_at").gte("created_at", daysAgoIso(days));
  return bucketByDay((data ?? []).map((r) => r.created_at), days);
}
