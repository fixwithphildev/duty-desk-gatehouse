"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT } from "@/lib/types";

export async function startPatrolAction(input: { route: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.route.trim()) throw new Error("Route is required.");

  const { error } = await supabaseAdmin.from("patrols").insert({
    officer_id: session.staffId,
    route: input.route.trim(),
    status: "In Progress",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/patrols");
  revalidatePath("/dashboard");
}

export async function completePatrolAction(id: string, notes: string) {
  await requireRole(GH_CAN_EDIT);
  const { error } = await supabaseAdmin
    .from("patrols")
    .update({ status: "Completed", ended_at: new Date().toISOString(), notes: notes.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/patrols");
  revalidatePath("/dashboard");
}
