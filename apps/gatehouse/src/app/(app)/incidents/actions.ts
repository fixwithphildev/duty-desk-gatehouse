"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT } from "@/lib/types";

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
