"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_TASKS } from "@/lib/types";

export async function createTaskAction(input: { description: string; assignedTo: string; dueTime: string }) {
  const session = await requireRole(DD_CAN_EDIT_TASKS);
  if (!input.description.trim()) throw new Error("Task description is required.");

  const { error } = await supabaseAdmin.from("tasks").insert({
    description: input.description.trim(),
    assigned_to: input.assignedTo.trim() || null,
    due_time: input.dueTime.trim() || null,
    status: "Pending",
    created_by: session.staffId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function markTaskDoneAction(id: string) {
  await requireSession();
  const { error } = await supabaseAdmin.from("tasks").update({ status: "Done" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
