"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_TICKETS } from "@/lib/types";
import { uploadTicketPhoto } from "@/lib/data/maintenance";

export async function createTicketAction(formData: FormData) {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  const area = String(formData.get("area") ?? "").trim();
  const issueType = String(formData.get("issueType") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "");
  const priority = String(formData.get("priority") ?? "Medium") as "Low" | "Medium" | "High";
  const photo = formData.get("photo") as File | null;

  if (!area || !issueType) throw new Error("Area and issue are required.");

  const { data: ticket, error } = await supabaseAdmin
    .from("maintenance_tickets")
    .insert({ area, issue_type: issueType, assigned_to: assignedTo, priority, status: "Reported", source: "manual", created_by: session.staffId, logged_by_name: session.displayName })
    .select()
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Failed to create ticket.");

  if (photo && photo.size > 0) {
    await uploadTicketPhoto(ticket.id, session.staffId, photo);
  }

  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function updateTicketStatusAction(id: string, status: "Reported" | "In Progress" | "Resolved") {
  const session = await requireSession();
  const { error } = await supabaseAdmin.from("maintenance_tickets").update({ status, logged_by_name: session.displayName, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}
