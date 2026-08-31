"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";

export async function createIncidentAction(input: {
  title: string;
  category: string;
  severity: string;
  location: string;
  description: string;
}) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.title.trim()) throw new Error("Title is required.");

  const { error } = await supabaseAdmin.from("incidents").insert({
    title: input.title.trim(),
    category: input.category,
    severity: input.severity,
    location: input.location.trim() || null,
    description: input.description.trim() || null,
    status: "Open",
    reported_by: session.staffId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

export async function updateIncidentStatusAction(id: string, status: "Open" | "In Progress" | "Resolved") {
  await requireSession();
  const { error } = await supabaseAdmin.from("incidents").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

// Corrects a mistaken entry without editing or deleting it — the original
// row stays fully visible, just marked not-actionable, with a required
// reason and who/when. Reserved for Supervisor/Management/Super Admin —
// a higher tier than routine logging/editing.
export async function voidIncidentAction(id: string, reason: string) {
  const session = await requireRole(GH_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void an incident.");

  const { error } = await supabaseAdmin
    .from("incidents")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}
