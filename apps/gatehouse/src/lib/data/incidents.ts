import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { Severity } from "@/lib/types";

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
}

export async function getIncidents(): Promise<IncidentRow[]> {
  const { data } = await supabaseAdmin
    .from("incidents")
    .select("id, title, category, severity, location, description, status, created_at, staff_accounts(display_name)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    category: row.category as string,
    severity: row.severity as Severity,
    location: row.location as string | null,
    description: row.description as string | null,
    status: row.status as IncidentRow["status"],
    created_at: row.created_at as string,
    reported_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? "—",
  }));
}

export async function getOpenIncidentsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("incidents").select("id", { count: "exact", head: true }).neq("status", "Resolved");
  return count ?? 0;
}
