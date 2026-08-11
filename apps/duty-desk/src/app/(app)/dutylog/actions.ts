"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_DUTY_LOG } from "@/lib/types";

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
