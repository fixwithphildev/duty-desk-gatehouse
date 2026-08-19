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
  const { data } = await ticketsDb
    .from("maintenance_tickets")
    .select("id, area, issue_type, priority, assigned_to, created_at")
    .in("assigned_to", MD_DEPARTMENTS)
    .gt("created_at", sinceIso);

  return (data ?? [])
    .map((row) => ({
      id: `tkt-${row.id}`,
      message: `New ${row.priority} priority ticket: ${row.issue_type} — ${row.area}`,
      href: "/tickets",
      createdAt: row.created_at as string,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
