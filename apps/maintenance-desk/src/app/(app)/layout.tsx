import { requireSession } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { getOpenTicketsCount } from "@/lib/data/tickets";
import { Sidebar } from "@/components/sidebar";
import { NotificationWatcher } from "@/components/notification-watcher";

// Every page under this route group is behind requireSession() (this layout)
// plus, where a page is admin-only (/admin), that page also calls
// requireRole()/requirePageAccess() itself.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const openTicketCount = await getOpenTicketsCount();

  return (
    <div className="app-shell">
      <Sidebar items={navForRole(session.role)} displayName={session.displayName} role={session.role} openTicketCount={openTicketCount} />
      <main className="main">{children}</main>
      <NotificationWatcher />
    </div>
  );
}
