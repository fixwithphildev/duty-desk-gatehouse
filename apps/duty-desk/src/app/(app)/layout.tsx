import { requireSession } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { getNotReadyCount } from "@/lib/data/checklists";
import { Sidebar } from "@/components/sidebar";
import { NotificationWatcher } from "@/components/notification-watcher";

// Every page under this route group is behind requireSession() (this layout)
// plus, where the blueprint's permission matrix restricts a role to specific
// pages (e.g. Housekeeping can't reach Residents), that page also calls
// requireRole([...]) itself — see src/lib/types.ts for the per-module role
// lists and src/lib/nav.ts for which pages each role's sidebar shows.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const notReadyCount = await getNotReadyCount();

  return (
    <div className="app-shell">
      <Sidebar items={navForRole(session.role)} displayName={session.displayName} role={session.role} notReadyCount={notReadyCount} />
      <main className="main">{children}</main>
      <NotificationWatcher />
    </div>
  );
}
