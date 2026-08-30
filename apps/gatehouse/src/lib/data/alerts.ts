import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { Severity } from "@/lib/types";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";

export interface AlertRow {
  id: string;
  type: string;
  severity: Severity;
  message: string;
  location: string | null;
  raised_by_name: string;
  status: "Unacknowledged" | "Acknowledged";
  acknowledged_by_name: string | null;
  created_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getAlerts(): Promise<AlertRow[]> {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .select(
      "id, type, severity, message, location, status, created_at, void, void_reason, voided_at, " +
        "raised_by:staff_accounts!alerts_raised_by_fkey(display_name), acknowledged_by:staff_accounts!alerts_acknowledged_by_fkey(display_name), voider:staff_accounts!alerts_voided_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    type: row.type as string,
    severity: row.severity as Severity,
    message: row.message as string,
    location: row.location as string | null,
    status: row.status as AlertRow["status"],
    created_at: row.created_at as string,
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_at: row.voided_at as string | null,
    raised_by_name: (row.raised_by as { display_name?: string } | null)?.display_name ?? "—",
    acknowledged_by_name: (row.acknowledged_by as { display_name?: string } | null)?.display_name ?? null,
    voided_by_name: (row.voider as { display_name?: string } | null)?.display_name ?? null,
  }));
}

export async function getUnacknowledgedAlertsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("alerts").select("id", { count: "exact", head: true }).eq("status", "Unacknowledged");
  return count ?? 0;
}

export async function getAlertsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await supabaseAdmin.from("alerts").select("created_at").gte("created_at", daysAgoIso(days));
  return bucketByDay((data ?? []).map((r) => r.created_at), days);
}
