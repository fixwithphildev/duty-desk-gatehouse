"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT } from "@/lib/types";

export async function logItemOutAction(input: { itemDesc: string; carriedBy: string; authorizedBy: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.itemDesc.trim() || !input.carriedBy.trim()) throw new Error("Item description and carrier are required.");

  const { error } = await supabaseAdmin.from("item_logs").insert({
    item_desc: input.itemDesc.trim(),
    carried_by: input.carriedBy.trim(),
    authorized_by: input.authorizedBy.trim() || null,
    status: "Out",
    logged_by: session.staffId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/items");
}

export async function markItemReturnedAction(id: string) {
  await requireRole(GH_CAN_EDIT);
  const { error } = await supabaseAdmin.from("item_logs").update({ status: "Returned", in_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/items");
}
