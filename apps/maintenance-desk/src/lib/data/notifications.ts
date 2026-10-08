import "server-only";
import { ticketsDb } from "@/lib/supabase";
import { LEGACY_UNITS, MD_UNITS, ticketRef } from "@/lib/types";

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  createdAt: string;
  tone?: "alert" | "good";
}

// What Maintenance hears about: every new job Duty Desk sends (a flagged
// check-in prep item, a reported problem, a complaint or a ticket an officer
// logs) and every new request. A technician only hears about their own unit.
export async function getNotificationsSince(sinceIso: string, unit: string | null): Promise<NotificationItem[]> {
  const units = unit ? [unit] : [...MD_UNITS, ...LEGACY_UNITS];
  const { data: created } = await ticketsDb
    .from("maintenance_tickets")
    .select("id, ref_no, area, issue_type, priority, assigned_to, source, requested_by_name, created_at")
    .in("assigned_to", units)
    .eq("void", false)
    .gt("created_at", sinceIso);

  const items: NotificationItem[] = [];
  for (const row of created ?? []) {
    const request = row.source === "request";
    items.push({
      id: `new-${row.id}`,
      message: request
        ? `New request ${ticketRef(row.ref_no)} from ${row.requested_by_name ?? "someone"}: ${row.issue_type} · ${row.area} (${row.assigned_to})`
        : `New ${String(row.priority).toLowerCase()} priority job from Duty Desk, ${ticketRef(row.ref_no)}: ${row.issue_type} · ${String(row.area).replace(/^apartment\s+/i, "")} (${row.assigned_to})`,
      href: `${request ? "/requests" : "/board"}?id=${row.id}`,
      createdAt: row.created_at as string,
      tone: row.priority === "High" ? "alert" : undefined,
    });
  }
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
