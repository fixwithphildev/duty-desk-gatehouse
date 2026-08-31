"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { MD_CAN_EDIT_TICKETS, MD_CAN_VOID, MD_DEPARTMENTS, type TicketStatus } from "@/lib/types";
import { createTicket, updateTicketStatus, voidTicket, uploadTicketPhoto, getTicketPhotoUrls } from "@/lib/data/tickets";

export async function createTicketAction(formData: FormData) {
  const session = await requireRole(MD_CAN_EDIT_TICKETS);
  const area = String(formData.get("area") ?? "").trim();
  const issueType = String(formData.get("issueType") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "");
  const priority = String(formData.get("priority") ?? "Medium") as "Low" | "Medium" | "High";
  const photo = formData.get("photo") as File | null;

  if (!area || !issueType) throw new Error("Area and issue are required.");
  if (!(MD_DEPARTMENTS as readonly string[]).includes(assignedTo)) throw new Error("Invalid department.");

  const { id } = await createTicket({ area, issueType, assignedTo, priority, loggedByName: session.displayName });

  if (photo && photo.size > 0) {
    await uploadTicketPhoto(id, photo);
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
}

export async function updateTicketStatusAction(id: string, status: TicketStatus) {
  const session = await requireSession();
  await updateTicketStatus(id, status, session.displayName);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
}

export async function voidTicketAction(id: string, reason: string) {
  const session = await requireRole(MD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a ticket.");
  await voidTicket(id, reason.trim(), session.displayName);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
}

export async function getTicketPhotosAction(id: string): Promise<string[]> {
  await requireSession();
  return getTicketPhotoUrls(id);
}
