import { requireRole, getStaffDirectory } from "@/lib/auth";
import { GH_STAFF_VIEW_ROLES } from "@/lib/types";
import { getLastSignIns, getRecentLoginEvents } from "@/lib/data/login-events";
import { whenText } from "@/lib/time";
import { StaffClient } from "./staff-client";

export default async function StaffAdminPage() {
  const session = await requireRole(GH_STAFF_VIEW_ROLES);
  const [accounts, loginEvents, last] = await Promise.all([getStaffDirectory(), getRecentLoginEvents(), getLastSignIns()]);
  const lastSeen = Object.fromEntries(accounts.map((a) => [a.id, last[a.username.toLowerCase()] ? whenText(last[a.username.toLowerCase()]) : null]));
  const events = loginEvents.map((e) => ({ ...e, when: whenText(e.created_at) }));
  return <StaffClient accounts={accounts} loginEvents={events} lastSeen={lastSeen} actorRole={session.role} me={session.staffId} />;
}
