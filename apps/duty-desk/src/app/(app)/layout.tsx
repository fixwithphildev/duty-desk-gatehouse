import { requireSession } from "@/lib/auth";
import { navForRole, type NavKey } from "@/lib/nav";
import { DD_ROLE_LABELS } from "@/lib/types";
import { getOpenComplaintsCount } from "@/lib/data/complaints";
import { getOpenTicketsCount } from "@/lib/data/maintenance";
import { getPendingTasksCount } from "@/lib/data/tasks";
import { getLastHandover } from "@/lib/data/dutylog";
import { AppShell, type NavCount } from "@/components/app-shell";
import type { PaletteItem } from "@/components/command-palette";

// Every page under this route group is behind requireSession() (this layout)
// plus, where the blueprint's permission matrix restricts a role to specific
// pages (e.g. Housekeeping can't reach Residents), that page also calls
// requireRole([...]) or requirePageAccess() itself — see src/lib/types.ts for
// the per-module role lists and src/lib/nav.ts for which pages each role sees.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const items = navForRole(session.role);
  const shows = (k: NavKey) => items.some((i) => i.iconKey === k);

  const [complaints, tickets, tasks, handover] = await Promise.all([
    shows("complaints") ? getOpenComplaintsCount() : 0,
    shows("maintenance") ? getOpenTicketsCount() : 0,
    shows("tasks") ? getPendingTasksCount() : 0,
    shows("dutylog") ? getLastHandover() : null,
  ]);
  const counts: Partial<Record<NavKey, NavCount>> = {
    complaints: { n: complaints },
    maintenance: { n: tickets },
    tasks: { n: tasks },
    dutylog: { n: handover ? 1 : 0, hot: true },
  };

  const search: PaletteItem[] = items.map((i) => ({ label: i.label, href: i.href, group: "Pages" }));

  return (
    <AppShell items={items} counts={counts} displayName={session.displayName} roleLabel={DD_ROLE_LABELS[session.role]} search={search}>
      {children}
    </AppShell>
  );
}
