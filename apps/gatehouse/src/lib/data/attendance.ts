import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface AttendanceRow {
  id: string;
  staff_name: string;
  role: string | null;
  in_at: string;
  out_at: string | null;
  status: "Signed In" | "Signed Out";
}

export async function getAttendanceLogs(): Promise<AttendanceRow[]> {
  const { data } = await supabaseAdmin.from("attendance_logs").select("*").order("in_at", { ascending: false });
  return (data ?? []) as AttendanceRow[];
}

export interface OffDutyRow {
  id: string;
  staff_name: string;
  department: string | null;
  reason: string | null;
  in_at: string;
  out_at: string | null;
  status: "Signed In" | "Signed Out";
}

export async function getOffDutyLogs(): Promise<OffDutyRow[]> {
  const { data } = await supabaseAdmin.from("off_duty_logs").select("*").order("in_at", { ascending: false });
  return (data ?? []) as OffDutyRow[];
}
