import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface VehicleLogRow {
  id: string;
  card_number: string;
  plate_number: string;
  driver_name: string | null;
  entry_at: string;
  exit_at: string | null;
  status: "In" | "Returned";
}

export async function getVehicleLogs(): Promise<VehicleLogRow[]> {
  const { data } = await supabaseAdmin.from("vehicle_logs").select("*").order("entry_at", { ascending: false });
  return (data ?? []) as VehicleLogRow[];
}

export async function getVehiclesOnPropertyCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("vehicle_logs").select("id", { count: "exact", head: true }).eq("status", "In");
  return count ?? 0;
}
