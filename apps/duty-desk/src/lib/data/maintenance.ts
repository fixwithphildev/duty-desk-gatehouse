import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { bucketByDay, daysAgoIso, type DailyCount } from "@/lib/trend";
import { allRows } from "./pages";

export interface MaintenanceTicketRow {
  id: string;
  ref_no: number | null; // shown as MT-0042
  area: string;
  issue_type: string;
  assigned_to: string;
  priority: "Low" | "Medium" | "High";
  status: "Reported" | "In Progress" | "Resolved";
  source: "manual" | "checklist" | "complaint" | "report"; // ("request" tickets are Maintenance Desk's own and never read here)
  notes: string | null;
  // Who last logged a change (Duty Desk or Maintenance Desk). It's overwritten on each update.
  logged_by_name: string | null;
  // The Duty Desk account that opened it. Empty when it was opened on Maintenance Desk.
  opened_by_name: string | null;
  created_at: string;
  updated_at: string;
  // Stops front desk selling the apartment until it's re-checked (a reported problem).
  blocks_sale: boolean;
  photo_count: number;
  // Recorded on Maintenance Desk when a technician starts and finishes the job.
  started_by_name: string | null;
  started_at: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  fix_note: string | null;
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
    .select("id, area, issue_type, assigned_to, priority, status, source, notes, logged_by_name, created_at, updated_at, blocks_sale, ref_no, started_by_name, started_at, resolved_by_name, resolved_at, fix_note, void, void_reason, voided_by_name, voided_at, maintenance_ticket_photos(id), creator:staff_accounts!maintenance_tickets_created_by_fkey(display_name)")
    // Requests (work asked for outside Duty Desk) belong to Maintenance Desk only.
    .neq("source", "request")
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
    opened_by_name: (row.creator as { display_name?: string } | null)?.display_name ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string | null) ?? (row.created_at as string),
    blocks_sale: !!row.blocks_sale,
    photo_count: Array.isArray(row.maintenance_ticket_photos) ? row.maintenance_ticket_photos.length : 0,
    ref_no: (row.ref_no as number | null) ?? null,
    started_by_name: (row.started_by_name as string | null) ?? null,
    started_at: (row.started_at as string | null) ?? null,
    resolved_by_name: (row.resolved_by_name as string | null) ?? null,
    resolved_at: (row.resolved_at as string | null) ?? null,
    fix_note: (row.fix_note as string | null) ?? null,
    void: row.void as boolean,
    void_reason: row.void_reason as string | null,
    voided_by_name: row.voided_by_name as string | null,
    voided_at: row.voided_at as string | null,
  }));
}

// Where each ticket came from: the complaint that opened it, or the checklist that
// flagged it. `checkout` holds the tickets that came from a check-out inspection
// (the rest of the checklist ones came from a check-in prep).
export async function getTicketOrigins(): Promise<{ complaint: Map<string, string>; checklist: Map<string, string>; checkout: Set<string> }> {
  const [cmp, items, outs] = await Promise.all([
    allRows((from, to) => supabaseAdmin.from("complaints").select("id, ticket_id").not("ticket_id", "is", null).order("id").range(from, to)),
    allRows((from, to) => supabaseAdmin.from("checklist_items").select("id, checklist_id, linked_ticket_id").not("linked_ticket_id", "is", null).order("id").range(from, to)),
    allRows((from, to) => supabaseAdmin.from("apartment_checklists").select("id").eq("type", "check_out_inspection").order("id").range(from, to)),
  ]);
  const complaint = new Map<string, string>(), checklist = new Map<string, string>(), checkout = new Set<string>();
  const outIds = new Set(outs.map((c) => c.id as string));
  for (const c of cmp) complaint.set(c.ticket_id as string, c.id as string);
  for (const i of items) {
    checklist.set(i.linked_ticket_id as string, i.checklist_id as string);
    if (outIds.has(i.checklist_id as string)) checkout.add(i.linked_ticket_id as string);
  }
  return { complaint, checklist, checkout };
}

export async function getOpenTicketsCount(): Promise<number> {
  const { count } = await supabaseAdmin.from("maintenance_tickets").select("id", { count: "exact", head: true }).neq("status", "Resolved").neq("source", "request").eq("void", false);
  return count ?? 0;
}

export async function getTicketsDailyTrend(days = 14): Promise<DailyCount[]> {
  const { data } = await supabaseAdmin.from("maintenance_tickets").select("created_at").neq("source", "request").gte("created_at", daysAgoIso(days));
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
