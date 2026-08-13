import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  createdAt: string;
}

// High-stakes-only trigger: a new Alert raised (Fire, Medical Emergency,
// Security Breach, Lockdown). Routine activity (incidents, patrols, key
// issue/return, attendance) intentionally does NOT notify — the point is
// to surface what actually needs attention, not create noise staff learn
// to ignore.
export async function getNotificationsSince(sinceIso: string): Promise<NotificationItem[]> {
  const { data } = await supabaseAdmin
    .from("alerts")
    .select("id, type, severity, message, location, created_at")
    .gt("created_at", sinceIso);

  return (data ?? [])
    .map((row) => ({
      id: `alt-${row.id}`,
      message: `${row.type} (${row.severity}): ${row.message}${row.location ? ` — ${row.location}` : ""}`,
      href: "/alerts",
      createdAt: row.created_at as string,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
