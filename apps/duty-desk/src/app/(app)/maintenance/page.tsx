import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_TICKETS } from "@/lib/types";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { MaintenanceClient } from "./maintenance-client";

export default async function MaintenancePage() {
  const session = await requirePageAccess("/maintenance");

  // Housekeeping/Engineering only see tickets assigned to their own department
  // (blueprint 4.3: "Can view: Assigned tickets"); everyone else sees all.
  let assignedFilter: string[] | undefined;
  if (session.role === "housekeeping") assignedFilter = ["Housekeeping"];
  if (session.role === "engineering") assignedFilter = ["Engineering", "General Maintenance"];

  const tickets = await getMaintenanceTickets(assignedFilter);

  return <MaintenanceClient tickets={tickets} canEdit={DD_CAN_EDIT_TICKETS.includes(session.role)} />;
}
