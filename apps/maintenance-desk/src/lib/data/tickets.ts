import "server-only";
import { randomUUID } from "node:crypto";
import { ticketsDb } from "@/lib/supabase";
import { MD_DEPARTMENTS, type TicketPriority, type TicketStatus } from "@/lib/types";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";

// Every function here talks to Duty Desk's Supabase project via `ticketsDb`
// (see lib/supabase.ts) — this is the one genuinely shared record between
// the two platforms, not a copy. Scoped to MD_DEPARTMENTS throughout:
// Housekeeping-assigned tickets are Duty Desk's own concern and never
// appear here.

export interface MaintenanceTicketRow {
  id: string;
  area: string;
  issue_type: string;
  assigned_to: string;
  priority: TicketPriority;
  status: TicketStatus;
  source: "manual" | "checklist";
  notes: string | null;
  logged_by_name: string | null;
  created_at: string;
  photo_count: number;
}

const PHOTOS_BUCKET = process.env.MAINTENANCE_PHOTOS_BUCKET || "maintenance-photos";

export async function getTickets(): Promise<MaintenanceTicketRow[]> {
  const { data } = await ticketsDb
    .from("maintenance_tickets")
    .select("id, area, issue_type, assigned_to, priority, status, source, notes, logged_by_name, created_at, maintenance_ticket_photos(id)")
    .in("assigned_to", MD_DEPARTMENTS)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    area: row.area as string,
    issue_type: row.issue_type as string,
    assigned_to: row.assigned_to as string,
    priority: row.priority as TicketPriority,
    status: row.status as TicketStatus,
    source: row.source as MaintenanceTicketRow["source"],
    notes: row.notes as string | null,
    logged_by_name: (row.logged_by_name as string | null) ?? null,
    created_at: row.created_at as string,
    photo_count: Array.isArray(row.maintenance_ticket_photos) ? row.maintenance_ticket_photos.length : 0,
  }));
}

export async function getOpenTicketsCount(): Promise<number> {
  const { count } = await ticketsDb
    .from("maintenance_tickets")
    .select("id", { count: "exact", head: true })
    .in("assigned_to", MD_DEPARTMENTS)
    .neq("status", "Resolved");
  return count ?? 0;
}

export async function getHighPriorityOpenCount(): Promise<number> {
  const { count } = await ticketsDb
    .from("maintenance_tickets")
    .select("id", { count: "exact", head: true })
    .in("assigned_to", MD_DEPARTMENTS)
    .eq("priority", "High")
    .neq("status", "Resolved");
  return count ?? 0;
}

export async function getTicketsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await ticketsDb
    .from("maintenance_tickets")
    .select("created_at")
    .in("assigned_to", MD_DEPARTMENTS)
    .gte("created_at", daysAgoIso(days));
  return bucketByDay((data ?? []).map((r) => r.created_at), days);
}

export async function createTicket(input: {
  area: string;
  issueType: string;
  assignedTo: string;
  priority: TicketPriority;
  loggedByName: string;
}): Promise<{ id: string }> {
  const { data, error } = await ticketsDb
    .from("maintenance_tickets")
    .insert({
      area: input.area,
      issue_type: input.issueType,
      assigned_to: input.assignedTo,
      priority: input.priority,
      status: "Reported",
      source: "manual",
      logged_by_name: input.loggedByName,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create ticket.");
  return { id: data.id as string };
}

export async function updateTicketStatus(id: string, status: TicketStatus, loggedByName: string): Promise<void> {
  const { error } = await ticketsDb
    .from("maintenance_tickets")
    .update({ status, logged_by_name: loggedByName, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadTicketPhoto(ticketId: string, file: File): Promise<void> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${ticketId}/${randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await ticketsDb.storage.from(PHOTOS_BUCKET).upload(path, arrayBuffer, {
    contentType: file.type || "image/jpeg",
  });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
  // uploaded_by is left null: it's a FK into Duty Desk's own staff_accounts,
  // which Maintenance Desk staff have no row in.
  await ticketsDb.from("maintenance_ticket_photos").insert({ ticket_id: ticketId, storage_path: path });
}

export async function getTicketPhotoUrls(ticketId: string): Promise<string[]> {
  const { data: photos } = await ticketsDb.from("maintenance_ticket_photos").select("storage_path").eq("ticket_id", ticketId);
  if (!photos || photos.length === 0) return [];
  const urls: string[] = [];
  for (const p of photos) {
    const { data } = await ticketsDb.storage.from(PHOTOS_BUCKET).createSignedUrl(p.storage_path, 60 * 10);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}
