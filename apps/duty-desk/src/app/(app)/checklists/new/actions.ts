"use server";

import { guarded } from "@/lib/action";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { ticketDeptFor } from "@/lib/checklist-data";
import { getChecklistInProgressForApartment, type InProgressChecklist } from "@/lib/data/checklists";
import type { ChecklistItemInput, ChecklistType } from "@/lib/types";

// A checklist is saved as the officer goes: it starts as 'in_progress', every
// answer is written straight away, and it's locked when they submit. While
// it's in progress everyone can see who is inspecting the apartment, nobody
// else can start the same apartment (the database allows one in-progress
// checklist per apartment), and another officer can take it over — for
// example at a shift change — with that recorded on the checklist.

export type StartResult = { ok: true; id: string } | { ok: false; taken: InProgressChecklist };

// Expected outcomes come back as results rather than thrown errors, so the
// screen can always say exactly what happened.
export type SaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; reason: "taken"; by: string }
  | { ok: false; reason: "gone" };

const revalidateChecklists = (id?: string) => {
  revalidatePath("/checklists");
  if (id) revalidatePath(`/checklists/${id}`);
  revalidatePath("/dashboard");
};

async function startChecklistAction__run(input: { apartment: string; type: ChecklistType }): Promise<StartResult> {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  const apartment = input.apartment.trim();
  if (!apartment) throw new Error("Apartment number is required.");

  const existing = await getChecklistInProgressForApartment(apartment);
  if (existing) return existing.prepared_by === session.staffId ? { ok: true, id: existing.id } : { ok: false, taken: existing };

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("apartment_checklists")
    .insert({
      apartment,
      type: input.type,
      prepared_by: session.staffId,
      status: "in_progress",
      // Never counts as Ready while in progress; set for real on submit.
      overall_ready: false,
      started_at: now,
      updated_at: now,
      created_at: now,
    })
    .select("id")
    .single();
  if (error || !data) {
    // Someone started the same apartment a moment ago, and the database
    // refused a second one (unique index, Postgres code 23505).
    if (error?.code === "23505") {
      const other = await getChecklistInProgressForApartment(apartment);
      if (other) return other.prepared_by === session.staffId ? { ok: true, id: other.id } : { ok: false, taken: other };
    }
    throw new Error(error?.message ?? "Couldn't start the checklist.");
  }

  revalidateChecklists();
  return { ok: true, id: data.id };
}

// Checks the checklist is still in progress and still this officer's.
async function ownDraft(id: string, staffId: string): Promise<{ ok: true; apartment: string } | Exclude<SaveResult, { ok: true }>> {
  const { data } = await supabaseAdmin
    .from("apartment_checklists")
    .select("apartment, status, void, prepared_by, staff_accounts!apartment_checklists_prepared_by_fkey(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.void || data.status !== "in_progress") return { ok: false, reason: "gone" };
  if (data.prepared_by !== staffId) {
    const by = (data.staff_accounts as unknown as { display_name?: string } | null)?.display_name ?? "Another officer";
    return { ok: false, reason: "taken", by };
  }
  return { ok: true, apartment: data.apartment as string };
}

const itemRow = (checklistId: string, item: ChecklistItemInput, linkedTicketId: string | null = null) => ({
  checklist_id: checklistId,
  name: item.name,
  category: item.category,
  kind: item.kind,
  qty: item.qty,
  condition: item.condition,
  available: item.available,
  note: item.note?.trim() || null,
  linked_ticket_id: linkedTicketId,
});

// Saves the answers changed since the last save (the form batches them),
// plus the type and the officer's Ready / Not Ready choice so far.
async function saveChecklistDraftAction__run(input: {
  id: string;
  items: ChecklistItemInput[];
  type?: ChecklistType;
  ready?: boolean | null;
}): Promise<SaveResult> {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  const own = await ownDraft(input.id, session.staffId);
  if (!own.ok) return own;

  if (input.items.length > 0) {
    const { error } = await supabaseAdmin
      .from("checklist_items")
      .upsert(input.items.map((item) => itemRow(input.id, item)), { onConflict: "checklist_id,name" });
    if (error) throw new Error(error.message);
  }
  const savedAt = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: savedAt };
  if (input.type) patch.type = input.type;
  if (input.ready !== undefined) patch.draft_ready = input.ready;
  const { error } = await supabaseAdmin.from("apartment_checklists").update(patch).eq("id", input.id).eq("prepared_by", session.staffId);
  if (error) throw new Error(error.message);
  return { ok: true, savedAt };
}

async function takeOverChecklistAction__run(id: string): Promise<{ ok: true } | { ok: false; reason: "gone" }> {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  const { data } = await supabaseAdmin.from("apartment_checklists").select("prepared_by, status, void").eq("id", id).maybeSingle();
  if (!data || data.void || data.status !== "in_progress") return { ok: false, reason: "gone" };
  if (data.prepared_by === session.staffId) return { ok: true };

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("apartment_checklists")
    .update({ prepared_by: session.staffId, taken_over_from: data.prepared_by, taken_over_at: now, updated_at: now })
    .eq("id", id)
    .eq("status", "in_progress");
  if (error) throw new Error(error.message);
  revalidateChecklists(id);
  return { ok: true };
}

// Stops an inspection without submitting it. It's voided rather than deleted,
// so there's still a record of who started it and who stopped it.
async function discardChecklistAction__run(id: string): Promise<never> {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("apartment_checklists")
    .update({ void: true, void_reason: "Stopped before it was submitted", voided_by: session.staffId, voided_at: now, updated_at: now })
    .eq("id", id)
    .eq("status", "in_progress")
    .eq("prepared_by", session.staffId);
  if (error) throw new Error(error.message);
  revalidateChecklists(id);
  redirect("/checklists");
}

async function submitChecklistAction__run(input: {
  id: string;
  type: ChecklistType;
  items: ChecklistItemInput[];
  // The officer's explicit Ready/Not Ready call — see checklist-form.tsx.
  // Flagged items still always create a maintenance ticket below regardless
  // of this value, so letting a guest check in despite a flagged item is
  // still fully traceable.
  overallReady: boolean;
}): Promise<SaveResult> {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  const own = await ownDraft(input.id, session.staffId);
  if (!own.ok) return own;
  const apartment = own.apartment;
  const typeLabel = input.type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection";

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
          notes: `${item.note?.trim() ? item.note.trim() + " — " : ""}Flagged as ${item.condition} during ${typeLabel} checklist`,
          created_by: session.staffId,
          logged_by_name: session.displayName,
        })
        .select()
        .single();
      if (ticket) ticketIdByItemName.set(item.name, ticket.id);
    })
  );

  // Every item in one round-trip, filling in anything not saved yet and
  // linking the flagged ones to their tickets.
  const { error: itemsError } = await supabaseAdmin
    .from("checklist_items")
    .upsert(input.items.map((item) => itemRow(input.id, item, ticketIdByItemName.get(item.name) ?? null)), { onConflict: "checklist_id,name" });
  if (itemsError) throw new Error(itemsError.message);

  // created_at becomes the submission time, which is what the checklist
  // list, the apartment's latest status and the alerts all go by.
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("apartment_checklists")
    .update({ status: "submitted", type: input.type, overall_ready: input.overallReady, draft_ready: null, created_at: now, updated_at: now })
    .eq("id", input.id)
    .eq("status", "in_progress");
  if (error) throw new Error(error.message);

  revalidateChecklists(input.id);
  revalidatePath("/maintenance");
  revalidateTag("checklists");
  redirect(`/checklists/${input.id}`);
}

export async function startChecklistAction(...args: Parameters<typeof startChecklistAction__run>) {
  return guarded(() => startChecklistAction__run(...args));
}

export async function saveChecklistDraftAction(...args: Parameters<typeof saveChecklistDraftAction__run>) {
  return guarded(() => saveChecklistDraftAction__run(...args));
}

export async function takeOverChecklistAction(...args: Parameters<typeof takeOverChecklistAction__run>) {
  return guarded(() => takeOverChecklistAction__run(...args));
}

export async function discardChecklistAction(...args: Parameters<typeof discardChecklistAction__run>) {
  return guarded(() => discardChecklistAction__run(...args));
}

export async function submitChecklistAction(...args: Parameters<typeof submitChecklistAction__run>) {
  return guarded(() => submitChecklistAction__run(...args));
}
