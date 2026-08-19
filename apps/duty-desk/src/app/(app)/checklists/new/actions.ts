"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { ticketDeptFor } from "@/lib/checklist-data";
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

  // Flagged items are typically a handful at most, so create their tickets
  // in parallel rather than one-by-one.
  const flaggedItems = input.items.filter((i) => i.condition === "Damaged" || i.condition === "Missing");
  const ticketIdByItemName = new Map<string, string>();
  await Promise.all(
    flaggedItems.map(async (item) => {
      const { data: ticket } = await supabaseAdmin
        .from("maintenance_tickets")
        .insert({
          area: `Apartment ${apartment}`,
          issue_type: item.name,
          assigned_to: ticketDeptFor(item.name),
          priority: item.condition === "Missing" ? "High" : "Medium",
          status: "Reported",
          source: "checklist",
          notes: `Flagged as ${item.condition} during ${typeLabel} checklist`,
          created_by: session.staffId,
          logged_by_name: session.displayName,
        })
        .select()
        .single();
      if (ticket) ticketIdByItemName.set(item.name, ticket.id);
    })
  );

  // All ~84 checklist items go in as a single bulk insert instead of one
  // round-trip per item — this is what was making submission slow.
  const { error: itemsError } = await supabaseAdmin.from("checklist_items").insert(
    input.items.map((item) => ({
      checklist_id: checklist.id,
      name: item.name,
      category: item.category,
      kind: item.kind,
      qty: item.qty,
      condition: item.condition,
      available: item.available,
      linked_ticket_id: ticketIdByItemName.get(item.name) ?? null,
    }))
  );
  if (itemsError) throw new Error(itemsError.message);

  revalidatePath("/checklists");
  revalidatePath("/dashboard");
  revalidatePath("/maintenance");
  revalidateTag("checklists");
  redirect(`/checklists/${checklist.id}`);
}
