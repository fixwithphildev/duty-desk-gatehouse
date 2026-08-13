import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  createdAt: string;
}

// High-stakes-only triggers, per the blueprint's accountability goals:
// an apartment going Not Ready, or a High-priority complaint/ticket.
// Routine activity (Good checklist items, Low/Medium priority items,
// duty log notes, etc.) intentionally does NOT notify — the point is to
// surface what actually needs attention, not create noise staff learn to
// ignore.
export async function getNotificationsSince(sinceIso: string): Promise<NotificationItem[]> {
  const [checklists, complaints, tickets] = await Promise.all([
    supabaseAdmin.from("apartment_checklists").select("id, apartment, created_at").eq("overall_ready", false).eq("status", "submitted").gt("created_at", sinceIso),
    supabaseAdmin.from("complaints").select("id, description, room, created_at").eq("priority", "High").gt("created_at", sinceIso),
    supabaseAdmin.from("maintenance_tickets").select("id, area, issue_type, created_at").eq("priority", "High").gt("created_at", sinceIso),
  ]);

  const items: NotificationItem[] = [];
  for (const row of checklists.data ?? []) {
    items.push({ id: `chk-${row.id}`, message: `Apartment ${row.apartment} marked Not Ready`, href: "/checklists", createdAt: row.created_at });
  }
  for (const row of complaints.data ?? []) {
    items.push({
      id: `cmp-${row.id}`,
      message: `High priority complaint${row.room ? ` — Room ${row.room}` : ""}: ${row.description}`,
      href: "/complaints",
      createdAt: row.created_at,
    });
  }
  for (const row of tickets.data ?? []) {
    items.push({ id: `tkt-${row.id}`, message: `High priority maintenance — ${row.area}: ${row.issue_type}`, href: "/maintenance", createdAt: row.created_at });
  }
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
