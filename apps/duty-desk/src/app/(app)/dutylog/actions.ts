"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_DUTY_LOG, DD_CAN_VOID } from "@/lib/types";

export async function addDutyLogEntryAction(input: { notes: string; handover: boolean }) {
  const session = await requireRole(DD_CAN_EDIT_DUTY_LOG);
  if (!input.notes.trim()) throw new Error("Log entry can't be empty.");

  const { error } = await supabaseAdmin.from("duty_log_entries").insert({
    officer_id: session.staffId,
    notes: input.notes.trim(),
    handover: input.handover,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dutylog");
  revalidatePath("/dashboard");
}

export async function voidDutyLogEntryAction(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a log entry.");
  const { error } = await supabaseAdmin
    .from("duty_log_entries")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dutylog");
  revalidatePath("/dashboard");
}
