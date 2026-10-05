export type MDRole = "maintenance_technician" | "maintenance_supervisor" | "head_of_operations" | "super_admin";

export const MD_ROLE_LABELS: Record<MDRole, string> = {
  maintenance_technician: "Maintenance Technician",
  maintenance_supervisor: "Maintenance Supervisor",
  head_of_operations: "Head of Operations",
  super_admin: "Super Admin (IT)",
};

// Roles allowed to administer staff accounts (create, disable, reset codes).
export const MD_ADMIN_ROLES: MDRole[] = ["maintenance_supervisor", "super_admin"];

// Everyone except Head of Operations can work tickets (create, update
// status, record what was bought). Head of Operations is oversight only —
// read-only, same as General Manager on Duty Desk.
export const MD_CAN_EDIT_TICKETS: MDRole[] = ["maintenance_technician", "maintenance_supervisor", "super_admin"];

// Voiding a mistaken ticket is a correction with real accountability
// weight, so it's reserved for a higher tier than routine create/edit —
// Maintenance Technician can log and update tickets but not void them.
// The same tier voids a wrongly entered purchase line.
export const MD_CAN_VOID: MDRole[] = ["maintenance_supervisor", "super_admin"];

// Who can see department-wide spending and download the spending reports.
// Technicians record what they bought on each ticket but don't get the
// overall spending picture.
export const MD_CAN_VIEW_SPENDING: MDRole[] = ["maintenance_supervisor", "head_of_operations", "super_admin"];

// Roles a Maintenance Supervisor may create/manage day-to-day. Super Admin
// can manage every role, including the Supervisor's own account and Head of
// Operations (who sits above the Supervisor, so the Supervisor can't).
export const MD_STAFF_ROLES: MDRole[] = ["maintenance_technician"];

export function assignableRolesFor(actorRole: MDRole): MDRole[] {
  if (actorRole === "super_admin") return ["maintenance_technician", "maintenance_supervisor", "head_of_operations", "super_admin"];
  if (actorRole === "maintenance_supervisor") return MD_STAFF_ROLES;
  return [];
}

export function canManageAccount(actorRole: MDRole, targetRole: MDRole): boolean {
  if (actorRole === "super_admin") return true;
  if (actorRole === "maintenance_supervisor") return MD_STAFF_ROLES.includes(targetRole);
  return false;
}

export interface StaffAccount {
  id: string;
  username: string;
  display_name: string;
  role: MDRole;
  disabled: boolean;
  must_change_code: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

// These values are dictated by the shared maintenance_tickets table living
// in Duty Desk's database (dd_priority / dd_ticket_status enums) — they
// must match exactly, since this platform reads and writes that same table.
export const MD_TICKET_STATUSES = ["Reported", "In Progress", "Resolved"] as const;
export type TicketStatus = (typeof MD_TICKET_STATUSES)[number];
export const MD_PRIORITIES = ["Low", "Medium", "High"] as const;
export type TicketPriority = (typeof MD_PRIORITIES)[number];

// Only the departments that are genuinely "Maintenance" work — Housekeeping-
// assigned tickets stay inside Duty Desk, handled by Housekeeping staff there.
export const MD_DEPARTMENTS = ["Engineering", "General Maintenance"] as const;

export function priorityTone(p: string): string {
  return p === "High" ? "red" : p === "Medium" ? "orange" : "blue";
}
export function statusTone(s: string): string {
  return s === "Resolved" ? "green" : s === "In Progress" ? "blue" : "orange";
}

// All maintenance spending is recorded and reported in Naira.
const NAIRA = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 });
export function formatNaira(amount: number): string {
  return NAIRA.format(amount);
}
