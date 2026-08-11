"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { GH_CAN_EDIT } from "@/lib/types";

export async function signInAction(input: { staffName: string; role: string }) {
  const session = await requireRole(GH_CAN_EDIT);
  if (!input.staffName.trim()) throw new Error("Staff name is required.");

  const { error } = await supabaseAdmin.from("attendance_logs").insert({
    staff_name: input.staffName.trim(),
    role: input.role.trim() || null,
    status: "Signed In",
    logged_by: session.staffId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/attendance");
}

export async function signOutAttendanceAction(id: string) {
  await requireRole(GH_CAN_EDIT);
  const { error } = await supabaseAdmin.from("attendance_logs").update({ status: "Signed Out", out_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/attendance");
}
