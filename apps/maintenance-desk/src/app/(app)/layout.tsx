import { requireSession } from "@/lib/auth";
import { navForRole, type NavKey } from "@/lib/nav";
import { MD_MONEY_ROLES, MD_ROLE_LABELS } from "@/lib/types";
import { getDesk, getMyUnit } from "@/lib/data/desk";
import { missingCost } from "@/lib/jobs";
import { AppShell, type NavCount } from "@/components/app-shell";
import type { PaletteItem } from "@/components/command-palette";

// Every page under this route group is behind requireSession() (this layout);
// pages limited to some roles also call requirePageAccess() themselves.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const items = navForRole(session.role);
  const [{ jobs }, unit] = await Promise.all([getDesk(), session.role === "maintenance_technician" ? getMyUnit(session.staffId) : Promise.resolve(null)]);

  const open = jobs.filter((j) => !j.void && j.status !== "Resolved" && (!unit || j.unit === unit));
  const board = open.filter((j) => !j.isRequest), requests = open.filter((j) => j.isRequest);
  const counts: Partial<Record<NavKey, NavCount>> = {
    board: { n: board.length, hot: board.some((j) => j.priority === "High" && j.status === "Reported") },
    requests: { n: requests.length },
  };
  if (MD_MONEY_ROLES.includes(session.role)) {
    counts.costs = { n: jobs.filter(missingCost).length, hot: true };
    counts.funding = { n: jobs.filter((j) => !j.void && j.fundStage === "balance-due").length, hot: true };
  }

  const search: PaletteItem[] = [
    ...items.map((i) => ({ label: i.label, sub: "Page", href: i.href, group: "Pages", keywords: i.label })),
    ...jobs
      .filter((j) => !j.void)
      .slice(0, 400)
      .map((j) => ({
        label: `${j.ref} · ${j.title}`,
        sub: `${j.area} · ${j.unit} · ${j.status === "In Progress" ? "in progress" : j.status.toLowerCase()}`,
        href: `${j.isRequest ? "/requests" : "/board"}?id=${j.id}`,
        group: j.isRequest ? "Requests" : "Ticket Board",
        keywords: `${j.ref} ${j.title} ${j.area} ${j.unit} ${j.requester?.name ?? ""}`,
      })),
  ];

  const unitLine = session.role === "maintenance_technician" ? (unit ? `${unit} unit` : "No unit set yet") : `${MD_ROLE_LABELS[session.role]} · all units`;
  return (
    <AppShell items={items} counts={counts} displayName={session.displayName} roleLabel={MD_ROLE_LABELS[session.role]} unitLine={unitLine} search={search}>
      {children}
    </AppShell>
  );
}
