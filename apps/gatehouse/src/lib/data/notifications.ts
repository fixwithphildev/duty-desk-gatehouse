import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { incRef } from "@/lib/types";

export interface NotificationItem {
  id: string;
  message: string;
  href: string;
  createdAt: string;
  tone?: "alert" | "good";
}

// High-stakes events only: a new alert (fire, medical emergency, security
// breach, lockdown) and a new High or Critical incident. Routine gate
// activity doesn't notify, so the chime keeps meaning something.
export async function getNotificationsSince(sinceIso: string): Promise<NotificationItem[]> {
  const [alerts, incidents] = await Promise.all([
    supabaseAdmin.from("alerts").select("id, type, severity, message, location, created_at").eq("void", false).gt("created_at", sinceIso),
    supabaseAdmin.from("incidents").select("id, ref_no, title, severity, location, created_at").in("severity", ["High", "Critical"]).eq("void", false).gt("created_at", sinceIso),
  ]);
  const items: NotificationItem[] = [];
  for (const a of alerts.data ?? []) {
    items.push({ id: `alt-${a.id}`, message: `${a.type} (${a.severity})${a.location ? ` · ${a.location}` : ""}: ${a.message}`, href: `/alerts?id=${a.id}`, createdAt: a.created_at as string, tone: "alert" });
  }
  for (const i of incidents.data ?? []) {
    items.push({ id: `inc-${i.id}`, message: `${i.severity} incident ${incRef(i.ref_no as number | null)}: ${i.title}${i.location ? ` · ${i.location}` : ""}`, href: `/incidents?id=${i.id}`, createdAt: i.created_at as string, tone: "alert" });
  }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
