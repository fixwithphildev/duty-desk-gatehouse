"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_TICKETS, DD_CAN_VOID } from "@/lib/types";
import { DD_PRIORITIES, DD_TICKET_DEPTS } from "@/lib/checklist-data";
import { findApartment } from "@/lib/apartments";
import { getTicketPhotoUrls, uploadTicketPhoto } from "@/lib/data/maintenance";

const refresh = () => {
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  revalidatePath("/board");
  revalidateTag("checklists");
};

// A new repair ticket. When the area is an apartment and "stop selling it"
// is ticked (a problem reported on the Readiness Board), the apartment shows
// Not ready until it's fixed and a new check-in prep is submitted Ready.
export async function createTicketAction(formData: FormData): Promise<{ id: string }> {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  const rawArea = String(formData.get("area") ?? "").trim();
  const issueType = String(formData.get("issueType") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "");
  const priority = String(formData.get("priority") ?? "Medium") as (typeof DD_PRIORITIES)[number];
  const blocksSale = formData.get("blocksSale") === "on";
  const photo = formData.get("photo") as File | null;

  if (!rawArea || !issueType) throw new Error("Say where it is and what’s wrong.");
  if (!DD_TICKET_DEPTS.includes(assignedTo)) throw new Error("Choose who it goes to.");
  if (!DD_PRIORITIES.includes(priority)) throw new Error("Choose a priority.");
  const apt = findApartment(rawArea);
  const area = apt ? `Apartment ${apt.name}` : rawArea;

  const { data: ticket, error } = await supabaseAdmin
    .from("maintenance_tickets")
    .insert({
      area,
      issue_type: issueType,
      assigned_to: assignedTo,
      priority,
      status: "Reported",
      source: blocksSale ? "report" : "manual",
      notes: notes || null,
      blocks_sale: !!apt && blocksSale,
      created_by: session.staffId,
      logged_by_name: session.displayName,
    })
    .select("id")
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Failed to create ticket.");

  if (photo && photo.size > 0) {
    await uploadTicketPhoto(ticket.id, session.staffId, photo);
  }

  refresh();
  return { id: ticket.id };
}

export async function updateTicketStatusAction(id: string, status: "Reported" | "In Progress" | "Resolved") {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  if (!["Reported", "In Progress", "Resolved"].includes(status)) throw new Error("Unknown status.");
  const { error } = await supabaseAdmin.from("maintenance_tickets").update({ status, logged_by_name: session.displayName, updated_at: new Date().toISOString() }).eq("id", id).eq("void", false);
  if (error) throw new Error(error.message);
  refresh();
}

export async function assignTicketAction(id: string, assignedTo: string) {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  if (!DD_TICKET_DEPTS.includes(assignedTo)) throw new Error("Choose who it goes to.");
  const { error } = await supabaseAdmin.from("maintenance_tickets").update({ assigned_to: assignedTo, logged_by_name: session.displayName, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function getTicketPhotosAction(id: string): Promise<string[]> {
  await requireSession();
  return getTicketPhotoUrls(id);
}

export async function addTicketPhotoAction(formData: FormData) {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  const id = String(formData.get("id") ?? "");
  const photo = formData.get("photo") as File | null;
  if (!id || !photo || photo.size === 0) throw new Error("Choose a photo first.");
  if (photo.size > 4 * 1024 * 1024) throw new Error("That photo is too large (4 MB at most).");
  await uploadTicketPhoto(id, session.staffId, photo);
  refresh();
}

export async function voidTicketAction(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a ticket.");
  const { error } = await supabaseAdmin
    .from("maintenance_tickets")
    .update({ void: true, void_reason: reason.trim(), voided_by_name: session.displayName, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
