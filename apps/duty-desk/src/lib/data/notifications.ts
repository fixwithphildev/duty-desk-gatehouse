import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { DDRole } from "@/lib/types";

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  createdAt: string;
  // "good" news (an apartment ready to sell) shows with a tick instead of a warning.
  tone?: "alert" | "good";
}

// High-stakes-only triggers, per the blueprint's accountability goals:
// an apartment going Not Ready, or a High-priority complaint/ticket.
// Routine activity (Good checklist items, Low/Medium priority items,
// duty log notes, etc.) intentionally does NOT notify — the point is to
// surface what actually needs attention, not create noise staff learn to
// ignore.
export async function getNotificationsSince(sinceIso: string, role?: DDRole): Promise<NotificationItem[]> {
  // Front desk is also told the moment an apartment is submitted Ready, so
  // they can sell it straight away. Only front desk: for everyone else it
  // would be routine noise.
  const readyForFrontDesk =
    role === "front_desk"
      ? supabaseAdmin
          .from("apartment_checklists")
          .select("id, apartment, created_at, staff_accounts!apartment_checklists_prepared_by_fkey(display_name)")
          .eq("overall_ready", true)
          .eq("status", "submitted")
          .eq("void", false)
          .gt("created_at", sinceIso)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> });
  const [checklists, complaints, tickets, ticketUpdates, readyNow] = await Promise.all([
    supabaseAdmin.from("apartment_checklists").select("id, apartment, created_at").eq("overall_ready", false).eq("status", "submitted").gt("created_at", sinceIso),
    supabaseAdmin.from("complaints").select("id, description, room, created_at").eq("priority", "High").gt("created_at", sinceIso),
    supabaseAdmin.from("maintenance_tickets").select("id, area, issue_type, created_at").eq("priority", "High").gt("created_at", sinceIso),
    // Status changes (e.g. Maintenance Desk marking something Resolved) —
    // deliberately NOT restricted to High priority the way ticket-creation
    // notifications above are. Creation noise is filtered because most new
    // tickets aren't urgent; but once someone's waiting to hear a ticket
    // got actioned, priority doesn't matter — a Medium-priority status
    // change should still surface here. Status changes don't have their
    // own "created_at" — they touch updated_at instead. Filtering
    // updated_at > created_at + a couple seconds is how this tells a
    // genuine status change apart from the row's own insert, since
    // PostgREST can't compare two columns to each other directly.
    supabaseAdmin
      .from("maintenance_tickets")
      .select("id, area, issue_type, status, logged_by_name, created_at, updated_at")
      .gt("updated_at", sinceIso),
    readyForFrontDesk,
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
  for (const row of ticketUpdates.data ?? []) {
    if (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() < 2000) continue;
    items.push({
      id: `tktupd-${row.id}-${row.updated_at}`,
      message: `${row.issue_type} (${row.area}) marked ${row.status}${row.logged_by_name ? ` by ${row.logged_by_name}` : ""}`,
      href: "/maintenance",
      createdAt: row.updated_at,
    });
  }
  for (const row of (readyNow.data ?? []) as Array<Record<string, unknown>>) {
    const by = (row.staff_accounts as { display_name?: string } | null)?.display_name;
    items.push({
      id: `rdy-${row.id}`,
      message: `Apartment ${row.apartment} is ready to sell${by ? ` — checked by ${by}` : ""}`,
      href: "/checklists",
      createdAt: row.created_at as string,
      tone: "good",
    });
  }
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
