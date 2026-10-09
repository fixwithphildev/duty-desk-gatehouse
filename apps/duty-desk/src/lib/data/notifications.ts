import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { DDRole } from "@/lib/types";
import { findApartment } from "@/lib/apartments";
import { naira, damageTotal } from "@/lib/money";

export interface NotificationItem {
  // Stable for the same event, so the bell never shows or chimes for it twice.
  id: string;
  message: string;
  href: string;
  createdAt: string;
  // "good" news (an apartment ready to sell) shows with a tick instead of a warning.
  tone?: "alert" | "good";
}

// Who's asking. People aren't alerted about what they did themselves.
export interface Viewer {
  role: DDRole;
  staffId?: string;
  displayName?: string;
}

const DAY = 24 * 60 * 60 * 1000;
const aptName = (raw: unknown) => findApartment(String(raw ?? ""))?.name ?? String(raw ?? "");

// High-stakes-only triggers, per the blueprint's accountability goals:
// an apartment going Not Ready, a High-priority complaint/ticket, and any
// change on a repair someone is waiting for. Routine activity (Good
// checklist items, Low/Medium priority items, duty log notes, etc.)
// intentionally does NOT notify: the point is to surface what actually needs
// attention, not create noise staff learn to ignore.
export async function getNotificationsSince(sinceIso: string, who: Viewer | DDRole): Promise<NotificationItem[]> {
  const me: Viewer = typeof who === "string" ? { role: who } : who;
  const frontDesk = me.role === "front_desk";
  const none = Promise.resolve({ data: [] as Array<Record<string, unknown>> });

  const [checklists, complaints, tickets, ticketUpdates, readyNow, damaged] = await Promise.all([
    supabaseAdmin
      .from("apartment_checklists")
      .select("id, apartment, type, prepared_by, created_at")
      .eq("overall_ready", false)
      .eq("status", "submitted")
      .eq("void", false)
      .gt("created_at", sinceIso),
    supabaseAdmin.from("complaints").select("id, description, room, created_by, created_at").eq("priority", "High").eq("void", false).gt("created_at", sinceIso),
    supabaseAdmin.from("maintenance_tickets").select("id, area, issue_type, created_by, created_at").eq("priority", "High").eq("void", false).neq("source", "request").gt("created_at", sinceIso),
    // Any change on a ticket (Maintenance Desk starting or finishing the job,
    // moving it to another team). Not only High priority: once someone's
    // waiting on a repair, they want to hear it moved. A change has no
    // created_at of its own, it touches updated_at; the row's own insert is
    // told apart below by updated_at being within 2 seconds of created_at
    // (PostgREST can't compare two columns).
    supabaseAdmin
      .from("maintenance_tickets")
      .select("id, area, issue_type, status, assigned_to, logged_by_name, started_by_name, resolved_by_name, created_at, updated_at")
      .eq("void", false)
      .neq("source", "request")
      .gt("updated_at", sinceIso),
    // Front desk is told the moment an apartment can be sold. Only a check-in
    // prep decides that (a check-out inspection never makes it sellable), and
    // only front desk is told: for everyone else it would be routine noise.
    frontDesk
      ? supabaseAdmin
          .from("apartment_checklists")
          .select("id, apartment, created_at, staff_accounts!apartment_checklists_prepared_by_fkey(display_name)")
          .eq("type", "check_in_prep")
          .eq("overall_ready", true)
          .eq("status", "submitted")
          .eq("void", false)
          .gt("created_at", sinceIso)
      : none,
    // And every guest who left damage that hasn't been charged yet. This goes
    // by what's outstanding, not by time: checked_out_at is when the guest
    // left, which is usually earlier than when the officer recorded it, so a
    // "since" filter would miss a check-out typed in a few minutes late. The
    // bell announces each one once (by id).
    frontDesk
      ? supabaseAdmin
          .from("resident_profiles")
          .select("id, name, room, damage, checked_out_at")
          .not("damage", "is", null)
          .is("damage_charged_at", null)
          .eq("void", false)
          .gt("checked_out_at", new Date(Date.now() - 14 * DAY).toISOString())
      : none,
  ]);

  const items: NotificationItem[] = [];
  for (const row of (checklists.data ?? []) as Array<Record<string, unknown>>) {
    if (me.staffId && row.prepared_by === me.staffId) continue;
    const apt = aptName(row.apartment);
    items.push({
      id: `chk-${row.id}`,
      message: row.type === "check_out_inspection" ? `${apt}: check-out inspection marked Not ready` : `${apt} marked Not ready`,
      href: `/checklists/${row.id}`,
      createdAt: row.created_at as string,
    });
  }
  for (const row of (complaints.data ?? []) as Array<Record<string, unknown>>) {
    if (me.staffId && row.created_by === me.staffId) continue;
    items.push({
      id: `cmp-${row.id}`,
      message: `High priority complaint${row.room ? ` — ${aptName(row.room)}` : ""}: ${row.description}`,
      href: `/complaints?id=${row.id}`,
      createdAt: row.created_at as string,
    });
  }
  for (const row of (tickets.data ?? []) as Array<Record<string, unknown>>) {
    if (me.staffId && row.created_by === me.staffId) continue;
    items.push({ id: `tkt-${row.id}`, message: `High priority maintenance — ${row.area}: ${row.issue_type}`, href: `/maintenance?id=${row.id}`, createdAt: row.created_at as string });
  }
  for (const row of (ticketUpdates.data ?? []) as Array<Record<string, unknown>>) {
    if (new Date(row.updated_at as string).getTime() - new Date(row.created_at as string).getTime() < 2000) continue;
    if (me.displayName && row.logged_by_name === me.displayName) continue;
    // Says where the repair stands now, which is true whatever the change was
    // (started, finished, or moved to another team).
    const area = String(row.area).replace(/^apartment\s+/i, "");
    const what = `${row.issue_type} (${area})`;
    const message =
      row.status === "Resolved" ? `${what} fixed by ${row.resolved_by_name ?? row.logged_by_name ?? "maintenance"}, ${row.assigned_to}`
        : row.status === "In Progress" ? `${what} in progress — ${row.started_by_name ?? row.logged_by_name ?? "maintenance"}, ${row.assigned_to}`
        : `${what} updated${row.logged_by_name ? ` by ${row.logged_by_name}` : ""} — now with ${row.assigned_to}`;
    items.push({
      id: `tktupd-${row.id}-${row.updated_at}`,
      message,
      tone: row.status === "Resolved" ? "good" : undefined,
      href: `/maintenance?id=${row.id}`,
      createdAt: row.updated_at as string,
    });
  }
  for (const row of (readyNow.data ?? []) as Array<Record<string, unknown>>) {
    const by = (row.staff_accounts as { display_name?: string } | null)?.display_name;
    const apt = aptName(row.apartment);
    items.push({
      id: `rdy-${row.id}`,
      message: `${apt} is ready to sell${by ? ` — checked by ${by}` : ""}`,
      href: `/frontdesk?apt=${encodeURIComponent(apt)}`,
      createdAt: row.created_at as string,
      tone: "good",
    });
  }
  for (const row of (damaged.data ?? []) as Array<Record<string, unknown>>) {
    const d = Array.isArray(row.damage) ? (row.damage as { charge: number }[]) : [];
    if (!d.length) continue;
    items.push({
      id: `dmg-${row.id}`,
      message: `${row.name} left ${aptName(row.room)} with damage to charge: ${naira(damageTotal(d))}`,
      href: "/frontdesk",
      createdAt: row.checked_out_at as string,
    });
  }
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
