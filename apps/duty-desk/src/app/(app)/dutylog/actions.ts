"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_DUTY_LOG, DD_CAN_VOID } from "@/lib/types";

const refresh = () => {
  revalidatePath("/dutylog");
  revalidatePath("/dashboard");
};

async function addDutyLogEntryAction__run(input: { notes: string; handover: boolean }) {
  const session = await requireRole(DD_CAN_EDIT_DUTY_LOG);
  if (!input.notes.trim()) throw new Error("Write what happened first.");

  const { error } = await supabaseAdmin.from("duty_log_entries").insert({
    officer_id: session.staffId,
    notes: input.notes.trim(),
    handover: input.handover,
  });
  if (error) throw new Error(error.message);
  refresh();
}

// Any signed-in officer on the next shift can acknowledge a handover note. It's about
// confirming they've read it, not an editing permission. The writer can't acknowledge
// their own note.
async function acknowledgeHandoverAction__run(id: string) {
  const session = await requireSession();
  const { data: entry } = await supabaseAdmin.from("duty_log_entries").select("officer_id").eq("id", id).maybeSingle();
  if (entry?.officer_id === session.staffId) throw new Error("The next shift acknowledges your handover note, not you.");

  const { error } = await supabaseAdmin
    .from("duty_log_entries")
    .update({ acknowledged_by: session.staffId, acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("handover", true)
    .is("acknowledged_at", null);
  if (error) throw new Error(error.message);
  refresh();
}

async function voidDutyLogEntryAction__run(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a log entry.");
  const { error } = await supabaseAdmin
    .from("duty_log_entries")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function addDutyLogEntryAction(...args: Parameters<typeof addDutyLogEntryAction__run>) {
  return guarded(() => addDutyLogEntryAction__run(...args));
}

export async function acknowledgeHandoverAction(...args: Parameters<typeof acknowledgeHandoverAction__run>) {
  return guarded(() => acknowledgeHandoverAction__run(...args));
}

export async function voidDutyLogEntryAction(...args: Parameters<typeof voidDutyLogEntryAction__run>) {
  return guarded(() => voidDutyLogEntryAction__run(...args));
}
