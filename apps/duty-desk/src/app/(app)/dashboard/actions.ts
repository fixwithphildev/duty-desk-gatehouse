"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Any signed-in officer can acknowledge a handover note — this is about
// confirming awareness, not an editing permission, so it isn't gated the
// way adding/editing log entries is.
export async function acknowledgeHandoverAction(id: string) {
  const session = await requireSession();

  const { error } = await supabaseAdmin
    .from("duty_log_entries")
    .update({ acknowledged_by: session.staffId, acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("handover", true);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dutylog");
}
