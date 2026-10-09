import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface DamageItem {
  item: string;
  charge: number; // naira
}

export interface ResidentRow {
  id: string;
  name: string;
  room: string;
  check_in: string | null; // planned dates, "2026-10-06"
  check_out: string | null;
  preferences: string | null;
  contact_info: string | null;
  notes: string | null;
  created_at: string;
  // A stay recorded in Duty Desk. Profiles added before check-ins were recorded have none of these.
  checked_in_at: string | null;
  checked_in_by_name: string | null;
  checked_out_at: string | null;
  checked_out_by_name: string | null;
  keys_returned: string | null;
  damage: DamageItem[];
  checkout_notes: string | null;
  damage_charged_at: string | null;
  damage_charged_by_name: string | null;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

const name = (v: unknown) => (v as { display_name?: string } | null)?.display_name ?? null;
const SELECT =
  "*, staff_accounts!resident_profiles_voided_by_fkey(display_name), inby:staff_accounts!resident_profiles_checked_in_by_fkey(display_name), " +
  "outby:staff_accounts!resident_profiles_checked_out_by_fkey(display_name), chargedby:staff_accounts!resident_profiles_damage_charged_by_fkey(display_name)";

function toRow(row: Record<string, unknown>): ResidentRow {
  return {
    ...(row as unknown as ResidentRow),
    checked_in_at: (row.checked_in_at as string | null) ?? null,
    checked_out_at: (row.checked_out_at as string | null) ?? null,
    keys_returned: (row.keys_returned as string | null) ?? null,
    damage: Array.isArray(row.damage) ? (row.damage as DamageItem[]) : [],
    checkout_notes: (row.checkout_notes as string | null) ?? null,
    damage_charged_at: (row.damage_charged_at as string | null) ?? null,
    checked_in_by_name: name(row.inby),
    checked_out_by_name: name(row.outby),
    damage_charged_by_name: name(row.chargedby),
    voided_by_name: name(row.staff_accounts),
  };
}

export async function getResidents(): Promise<ResidentRow[]> {
  const { data, error } = await supabaseAdmin.from("resident_profiles").select(SELECT).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toRow);
}

// Guests who left with damage front desk still has to charge.
export async function getDamageToCharge(): Promise<ResidentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("resident_profiles")
    .select(SELECT)
    .not("checked_out_at", "is", null)
    .is("damage_charged_at", null)
    .eq("void", false)
    .order("checked_out_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toRow).filter((r) => r.damage.length > 0);
}

