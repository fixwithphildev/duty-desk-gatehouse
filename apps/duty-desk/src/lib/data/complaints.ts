import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";

export interface ComplaintRow {
  id: string;
  guest_name: string | null;
  room: string | null;
  category: string;
  priority: "Low" | "Medium" | "High";
  description: string;
  status: "Open" | "In Progress" | "Resolved";
  updated_at: string | null;
  created_at: string;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
  assigned_to: string;
  resolution_note: string | null;
  ticket_id: string | null;
  in_progress_at: string | null;
  resolved_at: string | null;
  logged_by_name: string | null;
  resolved_by_name: string | null;
}

export async function getComplaints(): Promise<ComplaintRow[]> {
  const { data, error } = await supabaseAdmin
    .from("complaints")
    .select(
      "*, staff_accounts!complaints_voided_by_fkey(display_name), creator:staff_accounts!complaints_created_by_fkey(display_name), " +
        "resolver:staff_accounts!complaints_resolved_by_fkey(display_name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as ComplaintRow),
    voided_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? null,
    logged_by_name: (row.creator as { display_name?: string } | null)?.display_name ?? null,
    resolved_by_name: (row.resolver as { display_name?: string } | null)?.display_name ?? null,
  }));
}

export async function getOpenComplaintsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("complaints").select("id", { count: "exact", head: true }).neq("status", "Resolved");
  return count ?? 0;
}

export async function getComplaintsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await supabaseAdmin.from("complaints").select("created_at").gte("created_at", daysAgoIso(days));
  return bucketByDay((data ?? []).map((r) => r.created_at), days);
}
