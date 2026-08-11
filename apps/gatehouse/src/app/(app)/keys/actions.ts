"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT } from "@/lib/types";

export async function issueKeyAction(input: { keyType: string; area: string; issuedTo: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.area.trim() || !input.issuedTo.trim()) throw new Error("Area and issued-to are required.");

  const { error } = await supabaseAdmin.from("key_records").insert({
    key_type: input.keyType,
    area: input.area.trim(),
    issued_to: input.issuedTo.trim(),
    issued_by: session.staffId,
    status: "Issued",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/keys");
  revalidatePath("/dashboard");
}

export async function returnKeyAction(id: string) {
  await requireRole(GH_CAN_EDIT);
  const { error } = await supabaseAdmin.from("key_records").update({ status: "Returned", returned_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/keys");
  revalidatePath("/dashboard");
}

export async function markKeyLostAction(id: string) {
  await requireRole(GH_CAN_EDIT);
  const { error } = await supabaseAdmin.from("key_records").update({ status: "Lost" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/keys");
  revalidatePath("/dashboard");
}
