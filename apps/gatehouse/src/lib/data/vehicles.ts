import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { cardNo } from "@/lib/types";

// The gate's vehicle book: a card is handed over at the gate (card number +
// plate), and handed back when the vehicle leaves.
export interface VehicleLog {
  id: string;
  card: string; // "031"
  plate: string;
  driver: string | null;
  entry_at: string;
  exit_at: string | null;
  status: "In" | "Returned";
  logged_by_name: string | null;
  exit_by_name: string | null;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
}

const COLS =
  "id, card_number, plate_number, driver_name, entry_at, exit_at, status, void, void_reason, " +
  "logger:staff_accounts!vehicle_logs_logged_by_fkey(display_name), exiter:staff_accounts!vehicle_logs_exit_logged_by_fkey(display_name), " +
  "voider:staff_accounts!vehicle_logs_voided_by_fkey(display_name)";

const name = (v: unknown) => (v as { display_name?: string } | null)?.display_name ?? null;

function toLog(r: Record<string, unknown>): VehicleLog {
  return {
    id: r.id as string,
    card: cardNo(r.card_number as string),
    plate: r.plate_number as string,
    driver: (r.driver_name as string | null) || null,
    entry_at: r.entry_at as string,
    exit_at: (r.exit_at as string | null) ?? null,
    status: r.status as VehicleLog["status"],
    logged_by_name: name(r.logger),
    exit_by_name: name(r.exiter),
    void: !!r.void,
    void_reason: (r.void_reason as string | null) ?? null,
    voided_by_name: name(r.voider),
  };
}

// Every card that's out now, longest on property first.
export async function getCardsOut(): Promise<VehicleLog[]> {
  const { data, error } = await supabaseAdmin.from("vehicle_logs").select(COLS).eq("status", "In").eq("void", false).order("entry_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toLog);
}

// Entries and exits since a time, newest first (voided ones included, marked).
export async function getVehicleLogsSince(sinceIso: string, limit = 1000): Promise<VehicleLog[]> {
  const { data, error } = await supabaseAdmin
    .from("vehicle_logs")
    .select(COLS)
    .or(`entry_at.gte.${sinceIso},exit_at.gte.${sinceIso}`)
    .order("entry_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toLog);
}

export async function getAllVehicleLogs(): Promise<VehicleLog[]> {
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("vehicle_logs").select(COLS).order("entry_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
    if (!data || data.length < 1000) break;
  }
  return rows.map(toLog);
}

// The open entry for a card, if it's out.
export async function findCardOut(card: string): Promise<VehicleLog | null> {
  const out = await getCardsOut();
  return out.find((v) => v.card === cardNo(card)) ?? null;
}

export async function logEntry(input: { card: string; plate: string; driver: string | null }, staffId: string): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin
    .from("vehicle_logs")
    .insert({ card_number: cardNo(input.card), plate_number: input.plate, driver_name: input.driver, status: "In", logged_by: staffId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn’t log the entry.");
  return { id: data.id as string };
}

export async function logExit(id: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("vehicle_logs")
    .update({ status: "Returned", exit_at: new Date().toISOString(), exit_logged_by: staffId })
    .eq("id", id)
    .eq("status", "In");
  if (error) throw new Error(error.message);
}

export async function voidVehicleLog(id: string, reason: string, staffId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("vehicle_logs").update({ void: true, void_reason: reason, voided_by: staffId, voided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
