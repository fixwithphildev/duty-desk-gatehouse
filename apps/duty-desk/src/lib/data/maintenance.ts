import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

export interface MaintenanceTicketRow {
  id: string;
  area: string;
  issue_type: string;
  assigned_to: string;
  priority: "Low" | "Medium" | "High";
  status: "Reported" | "In Progress" | "Resolved";
  source: "manual" | "checklist";
  notes: string | null;
  created_at: string;
  photo_count: number;
}

const PHOTOS_BUCKET = process.env.MAINTENANCE_PHOTOS_BUCKET || "maintenance-photos";

export async function getMaintenanceTickets(assignedToFilter?: string[]): Promise<MaintenanceTicketRow[]> {
  let query = supabaseAdmin
    .from("maintenance_tickets")
    .select("id, area, issue_type, assigned_to, priority, status, source, notes, created_at, maintenance_ticket_photos(id)")
    .order("created_at", { ascending: false });
  if (assignedToFilter && assignedToFilter.length > 0) {
    query = query.in("assigned_to", assignedToFilter);
  }
  const { data } = await query;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    area: row.area as string,
    issue_type: row.issue_type as string,
    assigned_to: row.assigned_to as string,
    priority: row.priority as MaintenanceTicketRow["priority"],
    status: row.status as MaintenanceTicketRow["status"],
    source: row.source as MaintenanceTicketRow["source"],
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    photo_count: Array.isArray(row.maintenance_ticket_photos) ? row.maintenance_ticket_photos.length : 0,
  }));
}

export async function getOpenTicketsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("maintenance_tickets").select("id", { count: "exact", head: true }).neq("status", "Resolved");
  return count ?? 0;
}

export async function uploadTicketPhoto(ticketId: string, uploadedBy: string, file: File): Promise<void> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${ticketId}/${randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(path, arrayBuffer, {
    contentType: file.type || "image/jpeg",
  });
  if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
  await supabaseAdmin.from("maintenance_ticket_photos").insert({ ticket_id: ticketId, storage_path: path, uploaded_by: uploadedBy });
}

export async function getTicketPhotoUrls(ticketId: string): Promise<string[]> {
  const { data: photos } = await supabaseAdmin.from("maintenance_ticket_photos").select("storage_path").eq("ticket_id", ticketId);
  if (!photos || photos.length === 0) return [];
  const urls: string[] = [];
  for (const p of photos) {
    const { data } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).createSignedUrl(p.storage_path, 60 * 10);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}
