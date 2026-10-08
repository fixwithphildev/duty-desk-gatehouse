"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_COMPLAINTS, DD_CAN_VOID } from "@/lib/types";
import { DD_COMPLAINT_TEAMS, DD_TICKET_DEPTS } from "@/lib/checklist-data";
import { findApartment } from "@/lib/apartments";

const refresh = () => {
  revalidatePath("/complaints");
  revalidatePath("/dashboard");
};

export async function createComplaintAction(input: {
  guestName: string;
  room: string;
  category: string;
  priority: "Low" | "Medium" | "High";
  description: string;
  assignedTo: string;
  // Something is broken: also send a repair ticket to Maintenance Desk.
  repair: boolean;
}): Promise<{ id: string }> {
  const session = await requireRole(DD_CAN_EDIT_COMPLAINTS);
  const description = input.description.trim();
  if (!description) throw new Error("Say what happened.");
  const apt = findApartment(input.room);
  if (!apt) throw new Error("Choose the apartment from the list.");
  const team = DD_COMPLAINT_TEAMS.includes(input.assignedTo) ? input.assignedTo : "Resident Officers";

  let ticketId: string | null = null;
  if (input.repair) {
    const { data: ticket, error } = await supabaseAdmin
      .from("maintenance_tickets")
      .insert({
        area: `Apartment ${apt.name}`,
        issue_type: description.split(/[.;\n]/)[0].slice(0, 80),
        assigned_to: DD_TICKET_DEPTS.includes(team) ? team : "General Maintenance",
        priority: input.priority,
        status: "Reported",
        source: "complaint",
        notes: `From a ${input.category.toLowerCase()} complaint${input.guestName.trim() ? ` by ${input.guestName.trim()}` : ""}: ${description}`,
        created_by: session.staffId,
        logged_by_name: session.displayName,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    ticketId = ticket.id;
    revalidatePath("/maintenance");
  }

  const { data, error } = await supabaseAdmin
    .from("complaints")
    .insert({
      guest_name: input.guestName.trim() || null,
      room: apt.name,
      category: input.category,
      priority: input.priority,
      description,
      status: "Open",
      assigned_to: team,
      ticket_id: ticketId,
      created_by: session.staffId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  refresh();
  return { id: data.id };
}

export async function updateComplaintStatusAction(id: string, status: "Open" | "In Progress" | "Resolved", note?: string) {
  const session = await requireRole(DD_CAN_EDIT_COMPLAINTS);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === "In Progress") patch.in_progress_at = now;
  if (status === "Resolved") {
    patch.resolved_at = now;
    patch.resolved_by = session.staffId;
    if (note?.trim()) patch.resolution_note = note.trim();
  }
  if (status === "Open") { patch.resolved_at = null; patch.resolved_by = null; }
  const { error } = await supabaseAdmin.from("complaints").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function assignComplaintAction(id: string, assignedTo: string) {
  await requireRole(DD_CAN_EDIT_COMPLAINTS);
  if (!DD_COMPLAINT_TEAMS.includes(assignedTo)) throw new Error("Choose a team from the list.");
  const { error } = await supabaseAdmin.from("complaints").update({ assigned_to: assignedTo, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function voidComplaintAction(id: string, reason: string) {
  const session = await requireRole(DD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a complaint.");
  const { error } = await supabaseAdmin
    .from("complaints")
    .update({ void: true, void_reason: reason.trim(), voided_by: session.staffId, voided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}
