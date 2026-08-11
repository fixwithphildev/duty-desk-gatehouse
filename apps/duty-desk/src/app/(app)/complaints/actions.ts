"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_COMPLAINTS } from "@/lib/types";

export async function createComplaintAction(input: {
  guestName: string;
  room: string;
  category: string;
  priority: "Low" | "Medium" | "High";
  description: string;
}) {
  const session = await requireRole(DD_CAN_EDIT_COMPLAINTS);
  if (!input.description.trim()) throw new Error("Details are required.");

  const { error } = await supabaseAdmin.from("complaints").insert({
    guest_name: input.guestName.trim() || null,
    room: input.room.trim() || null,
    category: input.category,
    priority: input.priority,
    description: input.description.trim(),
    status: "Open",
    created_by: session.staffId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
}

export async function updateComplaintStatusAction(id: string, status: "Open" | "In Progress" | "Resolved") {
  await requireSession();
  const { error } = await supabaseAdmin.from("complaints").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/complaints");
  revalidatePath("/dashboard");
}
