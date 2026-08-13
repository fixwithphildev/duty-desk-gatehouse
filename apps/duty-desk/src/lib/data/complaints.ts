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
  created_at: string;
}

export async function getComplaints(): Promise<ComplaintRow[]> {
  const { data } = await supabaseAdmin.from("complaints").select("*").order("created_at", { ascending: false });
  return (data ?? []) as ComplaintRow[];
}

export async function getOpenComplaintsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("complaints").select("id", { count: "exact", head: true }).neq("status", "Resolved");
  return count ?? 0;
}

export async function getComplaintsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await supabaseAdmin.from("complaints").select("created_at").gte("created_at", daysAgoIso(days));
  return bucketByDay((data ?? []).map((r) => r.created_at), days);
}
