"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_TASKS, DD_CAN_VOID, type DDRole } from "@/lib/types";

// Housekeeping can tick off the tasks given to them, but not add tasks.
const CAN_TICK: DDRole[] = [...DD_CAN_EDIT_TASKS, "housekeeping"];

const refresh = () => {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
};

export async function createTaskAction(input: { description: string; assignedTo: string; dueTime: string }) {
  const session = await requireRole(DD_CAN_EDIT_TASKS);
  const description = input.description.trim(), assignedTo = input.assignedTo.trim(), due = input.dueTime.trim();
  if (!description) throw new Error("Say what needs doing.");
  if (!assignedTo) throw new Error("Choose who does it.");
  if (due && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(due)) throw new Error("Give a due time like 15:00.");

  const { error } = await supabaseAdmin.from("tasks").insert({
    description,
    assigned_to: assignedTo,
    due_time: due ? due.padStart(5, "0") : null,
    status: "Pending",
    created_by: session.staffId,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function markTaskDoneAction(id: string) {
  const session = await requireRole(CAN_TICK);
  const { error } = await supabaseAdmin.from("tasks").update({ status: "Done", done_at: new Date().toISOString(), done_by: session.staffId }).eq("id", id).eq("void", false);
  if (error) throw new Error(error.message);
  refresh();
}

export async function markTaskNotDoneAction(id: string) {
  await requireRole(CAN_TICK);
  const { error } = await supabaseAdmin.from("tasks").update({ status: "Pending", done_at: null, done_by: null }).eq("id", id).eq("void", false);
  if (error) throw new Error(error.message);
  refresh();
}

export async function voidTaskAction(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a task.");
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
