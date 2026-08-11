import { requireSession } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { getLatestSubmittedByApartment } from "@/lib/data/checklists";
import { Sidebar } from "@/components/sidebar";

// Every page under this route group is behind requireSession() (this layout)
// plus, where the blueprint's permission matrix restricts a role to specific
// pages (e.g. Housekeeping can't reach Residents), that page also calls
// requireRole([...]) itself — see src/lib/types.ts for the per-module role
// lists and src/lib/nav.ts for which pages each role's sidebar shows.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const notReady = await getLatestSubmittedByApartment();
  const notReadyCount = notReady.filter((c) => !c.overall_ready).length;

  return (
    <div className="app-shell">
      <Sidebar items={navForRole(session.role)} displayName={session.displayName} role={session.role} notReadyCount={notReadyCount} />
      <main className="main">{children}</main>
    </div>
  );
}
