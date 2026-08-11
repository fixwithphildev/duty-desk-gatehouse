import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

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
