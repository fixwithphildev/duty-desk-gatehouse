import { requireSession } from "@/lib/auth";
import { navForRole, type NavKey } from "@/lib/nav";
import { GH_CAN_EDIT, GH_ROLE_LABELS } from "@/lib/types";
import { bannerAlert, getDesk } from "@/lib/data/desk";
import { isOverdue, fmtDur, minsSince } from "@/lib/gate";
import { clockTime } from "@/lib/time";
import { AppShell, type NavCount } from "@/components/app-shell";
import { AlertBanner } from "@/components/alert-banner";
import type { PaletteItem } from "@/components/command-palette";

// Every page under this route group is behind requireSession() (this layout);
// Staff Accounts also calls requirePageAccess() itself.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const items = navForRole(session.role);
  const desk = await getDesk();

  const openInc = desk.incidents.filter((i) => !i.void && i.status !== "Resolved");
  const liveAlerts = desk.alerts.filter((a) => !a.void && a.status !== "Resolved");
  const counts: Partial<Record<NavKey, NavCount>> = {
    gate: { n: desk.out.length, hot: desk.out.some((v) => isOverdue(v.entry_at)) },
    items: { n: desk.items.filter((i) => !i.void && i.status === "Out").length },
    patrols: { n: desk.patrols.filter((p) => !p.void && p.status === "In Progress").length },
    incidents: { n: openInc.length, hot: openInc.some((i) => i.severity === "High" || i.severity === "Critical") },
    alerts: { n: liveAlerts.length, hot: liveAlerts.length > 0 },
  };

  const search: PaletteItem[] = [
    ...items.map((i) => ({ label: i.label, sub: "Page", href: i.href, group: "Pages", keywords: i.label })),
    ...desk.out.map((v) => ({
      label: v.plate,
      sub: `Card ${v.card}${v.driver ? ` · ${v.driver}` : ""} · on property ${fmtDur(minsSince(v.entry_at))}`,
      href: `/gate?card=${encodeURIComponent(v.card)}`,
      group: "Vehicles on property",
      keywords: `${v.card} ${v.plate} ${v.driver ?? ""}`,
    })),
    ...desk.incidents
      .filter((i) => !i.void)
      .slice(0, 300)
      .map((i) => ({ label: `${i.ref} · ${i.title}`, sub: `${i.severity} · ${i.location ?? "no location"} · ${i.status.toLowerCase()}`, href: `/incidents?id=${i.id}`, group: "Incidents", keywords: `${i.ref} ${i.title} ${i.location ?? ""} ${i.category}` })),
    ...desk.items
      .filter((i) => !i.void && i.status === "Out")
      .map((i) => ({ label: i.item, sub: `Out with ${i.carried_by}`, href: `/items?id=${i.id}`, group: "Items out", keywords: `${i.item} ${i.carried_by} ${i.authorized_by ?? ""}` })),
  ];

  const { alert, more } = bannerAlert(desk.alerts);
  const banner = alert ? (
    <AlertBanner
      alert={{
        id: alert.id, type: alert.type, severity: alert.severity, message: alert.message, location: alert.location, raisedBy: alert.raised_by_name,
        raisedAt: clockTime(alert.created_at), createdAt: alert.created_at, status: alert.status, ackBy: alert.acknowledged_by_name, ackAt: alert.acknowledged_at ? clockTime(alert.acknowledged_at) : null,
      }}
      more={more}
      canAct={GH_CAN_EDIT.includes(session.role)}
    />
  ) : null;

  const since = session.iat ? `signed in ${clockTime(new Date(session.iat * 1000).toISOString())}` : "signed in";
  return (
    <AppShell items={items} counts={counts} displayName={session.displayName} roleLabel={GH_ROLE_LABELS[session.role]} dutyLine={`${session.displayName} · ${since}`} search={search} banner={banner}>
      {children}
    </AppShell>
  );
}
