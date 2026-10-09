import "server-only";
import { randomUUID } from "node:crypto";
import { ticketsDb } from "@/lib/supabase";
import { LEGACY_UNITS, MD_UNITS, type TicketPriority, type TicketStatus } from "@/lib/types";

// Every function here talks to the shared maintenance_tickets table through
// `ticketsDb` (Duty Desk's public schema; see lib/supabase.ts). It holds:
//  - Duty Desk jobs (source checklist / complaint / report / manual): the Ticket Board.
//  - Requests (source request): work asked for outside Duty Desk, on the Requests page.
// Housekeeping tickets are Duty Desk's own and never appear here.

export interface Ticket {
  id: string;
  ref_no: number | null;
  area: string;
  issue_type: string;
  assigned_to: string; // a unit, or "Engineering" on older tickets
  priority: TicketPriority;
  status: TicketStatus;
  source: string;
  notes: string | null;
  logged_by_name: string | null; // who last changed it (overwritten on each update)
  created_by_name: string | null; // the Duty Desk officer who opened it, if one did
  created_at: string;
  updated_at: string;
  blocks_sale: boolean;
  photo_count: number;
  started_by_name: string | null;
  started_at: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  fix_note: string | null;
  requested_by_name: string | null;
  requested_by_role: string | null;
  requested_by_unit: string | null;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

export const isRequest = (t: { source: string }) => t.source === "request";

const COLUMNS =
  "id, ref_no, area, issue_type, assigned_to, priority, status, source, notes, logged_by_name, created_at, updated_at, blocks_sale, " +
  "started_by_name, started_at, resolved_by_name, resolved_at, fix_note, requested_by_name, requested_by_role, requested_by_unit, " +
  "void, void_reason, voided_by_name, voided_at, maintenance_ticket_photos(id), creator:staff_accounts!maintenance_tickets_created_by_fkey(display_name)";

const MD_ASSIGNMENTS = [...MD_UNITS, ...LEGACY_UNITS];

function toTicket(row: Record<string, unknown>): Ticket {
  return {
    ...(row as unknown as Ticket),
    ref_no: (row.ref_no as number | null) ?? null,
    created_by_name: (row.creator as { display_name?: string } | null)?.display_name ?? null,
    updated_at: (row.updated_at as string | null) ?? (row.created_at as string),
    blocks_sale: !!row.blocks_sale,
    photo_count: Array.isArray(row.maintenance_ticket_photos) ? row.maintenance_ticket_photos.length : 0,
  };
}

export async function getTickets(): Promise<Ticket[]> {
  const { data, error } = await ticketsDb.from("maintenance_tickets").select(COLUMNS).in("assigned_to", MD_ASSIGNMENTS).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(toTicket);
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const { data } = await ticketsDb.from("maintenance_tickets").select(COLUMNS).eq("id", id).in("assigned_to", MD_ASSIGNMENTS).maybeSingle();
  return data ? toTicket(data as unknown as Record<string, unknown>) : null;
}

// Starting or finishing a job records who did it and when. Duty Desk shows the same on its ticket.
export async function recordWork(id: string, input: { status: TicketStatus; who: string; at: string; note: string | null; loggedBy: string }): Promise<void> {
  const patch: Record<string, unknown> = { status: input.status, logged_by_name: input.loggedBy, updated_at: new Date().toISOString() };
  if (input.status === "In Progress") Object.assign(patch, { started_by_name: input.who, started_at: input.at, resolved_by_name: null, resolved_at: null });
  if (input.status === "Resolved") Object.assign(patch, { resolved_by_name: input.who, resolved_at: input.at, fix_note: input.note });
  if (input.status === "Reported") Object.assign(patch, { started_by_name: null, started_at: null, resolved_by_name: null, resolved_at: null, fix_note: null });
  const { error } = await ticketsDb.from("maintenance_tickets").update(patch).eq("id", id).eq("void", false);
  if (error) throw new Error(error.message);
}

export async function fillStartIfMissing(id: string, who: string, at: string): Promise<void> {
  await ticketsDb.from("maintenance_tickets").update({ started_by_name: who, started_at: at }).eq("id", id).is("started_at", null);
}

export async function assignUnit(id: string, unit: string, loggedBy: string): Promise<void> {
  const { error } = await ticketsDb.from("maintenance_tickets").update({ assigned_to: unit, logged_by_name: loggedBy, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createRequest(input: {
  area: string;
  issue: string;
  notes: string;
  unit: string;
  priority: TicketPriority;
  requestedByName: string;
  requestedByRole: string;
  requestedByUnit: string | null;
  loggedBy: string;
}): Promise<{ id: string }> {
  const { data, error } = await ticketsDb
    .from("maintenance_tickets")
    .insert({
      area: input.area,
      issue_type: input.issue,
      notes: input.notes || null,
      assigned_to: input.unit,
      priority: input.priority,
      status: "Reported",
      source: "request",
      requested_by_name: input.requestedByName,
      requested_by_role: input.requestedByRole,
      requested_by_unit: input.requestedByUnit,
      logged_by_name: input.loggedBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn’t save the request.");
  return { id: data.id as string };
}

export async function voidTicket(id: string, reason: string, voidedByName: string): Promise<void> {
  const { error } = await ticketsDb.from("maintenance_tickets").update({ void: true, void_reason: reason, voided_by_name: voidedByName, voided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

const PHOTOS_BUCKET = process.env.MAINTENANCE_PHOTOS_BUCKET || "maintenance-photos";

export async function uploadTicketPhoto(ticketId: string, file: File): Promise<void> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${ticketId}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await ticketsDb.storage.from(PHOTOS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type || "image/jpeg" });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
  // uploaded_by is left empty: it points at Duty Desk's staff accounts.
  await ticketsDb.from("maintenance_ticket_photos").insert({ ticket_id: ticketId, storage_path: path });
}

export async function getTicketPhotoUrls(ticketId: string): Promise<string[]> {
  const { data: photos } = await ticketsDb.from("maintenance_ticket_photos").select("storage_path").eq("ticket_id", ticketId);
  const urls: string[] = [];
  for (const p of photos ?? []) {
    const { data } = await ticketsDb.storage.from(PHOTOS_BUCKET).createSignedUrl(p.storage_path, 60 * 10);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}
