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
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export async function getVehicleLogs(): Promise<VehicleLogRow[]> {
  const { data, error } = await supabaseAdmin
    .from("vehicle_logs")
    .select("id, card_number, plate_number, driver_name, entry_at, exit_at, status, void, void_reason, voided_at, staff_accounts!vehicle_logs_voided_by_fkey(display_name)")
    .order("entry_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    card_number: row.card_number as string,
    plate_number: row.plate_number as string,
    driver_name: row.driver_name as string | null,
    entry_at: row.entry_at as string,
    exit_at: row.exit_at as string | null,
    status: row.status as VehicleLogRow["status"],
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_at: row.voided_at as string | null,
    voided_by_name: (row.staff_accounts as { display_name?: string } | null)?.display_name ?? null,
  }));
}

export async function getVehiclesOnPropertyCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("vehicle_logs").select("id", { count: "exact", head: true }).eq("status", "In");
  return count ?? 0;
}
