"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT } from "@/lib/types";

export async function raiseAlertAction(input: { type: string; severity: string; message: string; location: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.message.trim()) throw new Error("Message is required.");

  const { error } = await supabaseAdmin.from("alerts").insert({
    type: input.type,
    severity: input.severity,
    message: input.message.trim(),
    location: input.location.trim() || null,
    raised_by: session.staffId,
    status: "Unacknowledged",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}

export async function acknowledgeAlertAction(id: string) {
  const session = await requireRole(GH_CAN_EDIT);
  const { error } = await supabaseAdmin
    .from("alerts")
    .update({ status: "Acknowledged", acknowledged_by: session.staffId, acknowledged_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}

export async function voidAlertAction(id: string, reason: string) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!reason.trim()) throw new Error("A reason is required to void an alert.");
  const { error } = await supabaseAdmin
    .from("alerts")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}
