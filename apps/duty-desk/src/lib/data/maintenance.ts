import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";

export interface MaintenanceTicketRow {
  id: string;
  area: string;
  issue_type: string;
  assigned_to: string;
  priority: "Low" | "Medium" | "High";
  status: "Reported" | "In Progress" | "Resolved";
  source: "manual" | "checklist";
  notes: string | null;
  logged_by_name: string | null;
  created_at: string;
  photo_count: number;
  void: boolean;
  void_reason: string | null;
  voided_by_name: string | null;
  voided_at: string | null;
}

const PHOTOS_BUCKET = process.env.MAINTENANCE_PHOTOS_BUCKET || "maintenance-photos";

export async function getMaintenanceTickets(assignedToFilter?: string[]): Promise<MaintenanceTicketRow[]> {
  // voided_by_name is plain text, not a staff_accounts foreign key — this
  // table is shared with Maintenance Desk's separate Supabase project via a
  // direct connection (see lib/supabase.ts), and a Maintenance Desk staffer
  // has no row in Duty Desk's staff_accounts to reference (same reason
  // logged_by_name is text instead of a FK).
  let query = supabaseAdmin
    .from("maintenance_tickets")
    .select("id, area, issue_type, assigned_to, priority, status, source, notes, logged_by_name, created_at, void, void_reason, voided_by_name, voided_at, maintenance_ticket_photos(id)")
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
    logged_by_name: (row.logged_by_name as string | null) ?? null,
    created_at: row.created_at as string,
    photo_count: Array.isArray(row.maintenance_ticket_photos) ? row.maintenance_ticket_photos.length : 0,
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_by_name: row.voided_by_name as string | null,
    voided_at: row.voided_at as string | null,
  }));
}

export async function getOpenTicketsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("maintenance_tickets").select("id", { count: "exact", head: true }).neq("status", "Resolved");
  return count ?? 0;
}

export async function getTicketsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await supabaseAdmin.from("maintenance_tickets").select("created_at").gte("created_at", daysAgoIso(days));
  return bucketByDay((data ?? []).map((r) => r.created_at), days);
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
