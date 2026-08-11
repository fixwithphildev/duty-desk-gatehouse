import { requireSession } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { getUnacknowledgedAlertsCount } from "@/lib/data/alerts";
import { Sidebar } from "@/components/sidebar";

// Every page under this route group is behind requireSession() (this layout)
// plus, where the blueprint's permission matrix restricts a role (only
// Security Supervisor/Super Admin can reach /admin), that page also calls
// requireRole()/requirePageAccess() itself.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const unackAlertCount = await getUnacknowledgedAlertsCount();

  return (
    <div className="app-shell">
      <Sidebar items={navForRole(session.role)} displayName={session.displayName} role={session.role} unackAlertCount={unackAlertCount} />
      <main className="main">{children}</main>
    </div>
  );
}
