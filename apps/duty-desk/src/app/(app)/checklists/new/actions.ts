"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import type { ChecklistItemInput, ChecklistType } from "@/lib/types";

export async function submitChecklistAction(input: {
  apartment: string;
  type: ChecklistType;
  items: ChecklistItemInput[];
  // The officer's explicit Ready/Not Ready call, not a purely automatic
  // derivation — see checklist-form.tsx. Flagged items still always create
  // a maintenance ticket below regardless of this value, so letting a guest
  // check in despite a flagged item is still fully traceable.
  overallReady: boolean;
}): Promise<never> {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  const apartment = input.apartment.trim();
  if (!apartment) throw new Error("Apartment number is required.");

  const typeLabel = input.type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection";

  const { data: checklist, error } = await supabaseAdmin
    .from("apartment_checklists")
    .insert({
      apartment,
      type: input.type,
      prepared_by: session.staffId,
      status: "submitted",
      overall_ready: input.overallReady,
    })
    .select()
    .single();
  if (error || !checklist) throw new Error(error?.message ?? "Failed to create checklist.");

  for (const item of input.items) {
    let linkedTicketId: string | null = null;
    if (item.condition === "Damaged" || item.condition === "Missing") {
      const { data: ticket } = await supabaseAdmin
        .from("maintenance_tickets")
        .insert({
          area: `Apartment ${apartment}`,
          issue_type: item.name,
          assigned_to: "Engineering",
          priority: item.condition === "Missing" ? "High" : "Medium",
          status: "Reported",
          source: "checklist",
          notes: `Flagged as ${item.condition} during ${typeLabel} checklist`,
          created_by: session.staffId,
        })
        .select()
        .single();
      linkedTicketId = ticket?.id ?? null;
    }
    await supabaseAdmin.from("checklist_items").insert({
      checklist_id: checklist.id,
      name: item.name,
      category: item.category,
      kind: item.kind,
      qty: item.qty,
      condition: item.condition,
      available: item.available,
      linked_ticket_id: linkedTicketId,
    });
  }

  revalidatePath("/checklists");
  revalidatePath("/dashboard");
  revalidatePath("/maintenance");
  redirect(`/checklists/${checklist.id}`);
}
