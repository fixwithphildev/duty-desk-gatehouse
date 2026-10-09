"use server";

import { guarded } from "@/lib/action";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_VOID } from "@/lib/types";

// Voiding a checklist removes it from consideration for the apartment's
// Ready/Not-Ready status (see getLatestSubmittedByApartment/getNotReadyCount
// in lib/data/checklists.ts, both of which now filter void = false) — the
// next most recent submitted checklist for that apartment becomes
// authoritative again, same as if this one had never been submitted. The
// original entry and all its items stay fully visible for the record.
async function voidChecklistAction__run(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a checklist.");

  const { error } = await supabaseAdmin
    .from("apartment_checklists")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/checklists");
  revalidatePath(`/checklists/${id}`);
  revalidatePath("/dashboard");
  revalidateTag("checklists");
}

export async function voidChecklistAction(...args: Parameters<typeof voidChecklistAction__run>) {
  return guarded(() => voidChecklistAction__run(...args));
}
