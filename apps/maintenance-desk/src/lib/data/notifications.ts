import "server-only";
import { ticketsDb } from "@/lib/supabase";
import { MD_DEPARTMENTS } from "@/lib/types";

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  createdAt: string;
}

// Every new ticket matters here — unlike Duty Desk/Gatehouse, where
// notifications are deliberately high-stakes-only to avoid noise across a
// large module set, ticket creation *is* the primary event this whole
// platform exists to surface. Reads through the same shared connection as
// the rest of lib/data/tickets.ts — there's no separate "sync" to poll,
// just the same row Duty Desk just inserted.
export async function getNotificationsSince(sinceIso: string): Promise<NotificationItem[]> {
  const [{ data: created }, { data: updated }] = await Promise.all([
    ticketsDb
      .from("maintenance_tickets")
      .select("id, area, issue_type, priority, assigned_to, created_at")
      .in("assigned_to", MD_DEPARTMENTS)
      .gt("created_at", sinceIso),
    // Status changes (e.g. Duty Desk marking something In Progress) don't
    // have their own "created_at" — they touch updated_at instead.
    // Filtering updated_at > created_at + a couple seconds is how this
    // tells a genuine status change apart from the row's own insert,
    // since PostgREST can't compare two columns to each other directly.
    ticketsDb
      .from("maintenance_tickets")
      .select("id, area, issue_type, status, logged_by_name, assigned_to, created_at, updated_at")
      .in("assigned_to", MD_DEPARTMENTS)
      .gt("updated_at", sinceIso),
  ]);

  const items: NotificationItem[] = [];
  for (const row of created ?? []) {
    items.push({
      id: `tkt-${row.id}`,
      message: `New ${row.priority} priority ticket: ${row.issue_type} — ${row.area}`,
      href: "/tickets",
      createdAt: row.created_at as string,
    });
  }
  for (const row of updated ?? []) {
    if (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() < 2000) continue;
    items.push({
      id: `tktupd-${row.id}-${row.updated_at}`,
      message: `${row.issue_type} (${row.area}) marked ${row.status}${row.logged_by_name ? ` by ${row.logged_by_name}` : ""}`,
      href: "/tickets",
      createdAt: row.updated_at,
    });
  }
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
