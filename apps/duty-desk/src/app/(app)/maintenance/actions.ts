"use server";

import { randomUUID } from "node:crypto";
import { guarded } from "@/lib/action";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_TICKETS, DD_CAN_VOID } from "@/lib/types";
import { DD_MAX_MAINTENANCE_REASONS, DD_PRIORITIES, DD_TICKET_DEPTS } from "@/lib/checklist-data";
import { findApartment } from "@/lib/apartments";
import { getTicketPhotoUrls, uploadTicketPhoto } from "@/lib/data/maintenance";

const refresh = () => {
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  revalidatePath("/board");
  revalidatePath("/frontdesk");
  revalidateTag("checklists");
};

// Puts an apartment under maintenance from the Readiness Board, for one or more reasons. Each
// reason is its own repair ticket for its team, and stops front desk selling the apartment
// until it's fixed and a new check-in prep is submitted Ready. Who and when come from the ticket.
async function putUnderMaintenanceAction__run(formData: FormData): Promise<{ ids: string[]; photosFailed: number }> {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  const apt = findApartment(String(formData.get("apartment") ?? ""));
  if (!apt) throw new Error("Choose the apartment from the list.");
  let reasons: { issue?: unknown; dept?: unknown; priority?: unknown; notes?: unknown }[];
  try {
    reasons = JSON.parse(String(formData.get("reasons") ?? "[]"));
  } catch {
    reasons = [];
  }
  if (!Array.isArray(reasons) || !reasons.length) throw new Error("Say what’s wrong.");
  if (reasons.length > DD_MAX_MAINTENANCE_REASONS) throw new Error(`Give at most ${DD_MAX_MAINTENANCE_REASONS} reasons at a time.`);
  const rows = reasons.map((r, i) => {
    const issue = String(r.issue ?? "").trim(), dept = String(r.dept ?? ""), priority = String(r.priority ?? "") as (typeof DD_PRIORITIES)[number];
    const which = reasons.length > 1 ? ` for reason ${i + 1}` : "";
    if (!issue) throw new Error(`Say what’s wrong${which}.`);
    if (!DD_TICKET_DEPTS.includes(dept)) throw new Error(`Choose who it goes to${which}.`);
    if (!DD_PRIORITIES.includes(priority)) throw new Error(`Choose a priority${which}.`);
    return {
      id: randomUUID(),
      area: `Apartment ${apt.name}`,
      issue_type: issue,
      assigned_to: dept,
      priority,
      status: "Reported",
      source: "report",
      notes: String(r.notes ?? "").trim() || null,
      blocks_sale: true,
      created_by: session.staffId,
      logged_by_name: session.displayName,
    };
  });

  // All the tickets in one go, so it's every reason or none.
  const { error } = await supabaseAdmin.from("maintenance_tickets").insert(rows);
  if (error) throw new Error(error.message);

  // A photo that fails doesn't undo the tickets; the officer is told and can add it on the ticket.
  const uploads = await Promise.allSettled(
    rows.map(async (row, i) => {
      const photo = formData.get(`photo${i}`) as File | null;
      if (photo && photo.size > 0) await uploadTicketPhoto(row.id, session.staffId, photo);
    })
  );
  refresh();
  return { ids: rows.map((r) => r.id), photosFailed: uploads.filter((u) => u.status === "rejected").length };
}

// A new repair ticket. When the area is an apartment and "put it under
// maintenance" is ticked, the apartment shows Under maintenance until it's
// fixed and a new check-in prep is submitted Ready.
async function createTicketAction__run(formData: FormData): Promise<{ id: string }> {
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

async function updateTicketStatusAction__run(id: string, status: "Reported" | "In Progress" | "Resolved") {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  if (!["Reported", "In Progress", "Resolved"].includes(status)) throw new Error("Unknown status.");
  const now = new Date().toISOString();
  // Same record Maintenance Desk keeps: who started or finished it, and when.
  const work =
    status === "In Progress" ? { started_by_name: session.displayName, started_at: now }
      : status === "Resolved" ? { resolved_by_name: session.displayName, resolved_at: now }
      : { started_by_name: null, started_at: null, resolved_by_name: null, resolved_at: null, fix_note: null };
  const { error } = await supabaseAdmin.from("maintenance_tickets").update({ status, ...work, logged_by_name: session.displayName, updated_at: now }).eq("id", id).eq("void", false);
  if (error) throw new Error(error.message);
  refresh();
}

async function assignTicketAction__run(id: string, assignedTo: string) {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  if (!DD_TICKET_DEPTS.includes(assignedTo)) throw new Error("Choose who it goes to.");
  const { error } = await supabaseAdmin.from("maintenance_tickets").update({ assigned_to: assignedTo, logged_by_name: session.displayName, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

async function getTicketPhotosAction__run(id: string): Promise<string[]> {
  await requireSession();
  return getTicketPhotoUrls(id);
}

async function addTicketPhotoAction__run(formData: FormData) {
  const session = await requireRole(DD_CAN_EDIT_TICKETS);
  const id = String(formData.get("id") ?? "");
  const photo = formData.get("photo") as File | null;
  if (!id || !photo || photo.size === 0) throw new Error("Choose a photo first.");
  if (photo.size > 4 * 1024 * 1024) throw new Error("That photo is too large (4 MB at most).");
  await uploadTicketPhoto(id, session.staffId, photo);
  refresh();
}

async function voidTicketAction__run(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a ticket.");
  const { error } = await supabaseAdmin
    .from("maintenance_tickets")
    .update({ void: true, void_reason: reason.trim(), voided_by_name: session.displayName, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function createTicketAction(...args: Parameters<typeof createTicketAction__run>) {
  return guarded(() => createTicketAction__run(...args));
}

export async function putUnderMaintenanceAction(...args: Parameters<typeof putUnderMaintenanceAction__run>) {
  return guarded(() => putUnderMaintenanceAction__run(...args));
}

export async function updateTicketStatusAction(...args: Parameters<typeof updateTicketStatusAction__run>) {
  return guarded(() => updateTicketStatusAction__run(...args));
}

export async function assignTicketAction(...args: Parameters<typeof assignTicketAction__run>) {
  return guarded(() => assignTicketAction__run(...args));
}

export async function getTicketPhotosAction(...args: Parameters<typeof getTicketPhotosAction__run>) {
  return guarded(() => getTicketPhotosAction__run(...args));
}

export async function addTicketPhotoAction(...args: Parameters<typeof addTicketPhotoAction__run>) {
  return guarded(() => addTicketPhotoAction__run(...args));
}

export async function voidTicketAction(...args: Parameters<typeof voidTicketAction__run>) {
  return guarded(() => voidTicketAction__run(...args));
}
