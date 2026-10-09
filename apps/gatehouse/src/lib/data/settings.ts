import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_RACK_SIZE } from "@/lib/types";

// How many vehicle cards the gate hands out (001 up). The Admin sets it on
// the Gate Console; until the settings table exists it falls back to 60.
export async function getRackSize(): Promise<number> {
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", "rack_size").maybeSingle();
  const n = Number(data?.value);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_RACK_SIZE;
}

export async function setRackSize(n: number, byName: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("settings")
    .upsert({ key: "rack_size", value: String(n), updated_by_name: byName, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
