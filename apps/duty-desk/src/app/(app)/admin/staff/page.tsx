import { requireRole, getStaffDirectory } from "@/lib/auth";
import { DD_STAFF_VIEW_ROLES } from "@/lib/types";
import { getRecentLoginEvents } from "@/lib/data/login-events";
import { StaffClient } from "./staff-client";

export default async function StaffAdminPage() {
  const session = await requireRole(DD_STAFF_VIEW_ROLES);
  const [accounts, loginEvents] = await Promise.all([getStaffDirectory(), getRecentLoginEvents()]);
  return <StaffClient accounts={accounts} loginEvents={loginEvents} actorRole={session.role} />;
}
