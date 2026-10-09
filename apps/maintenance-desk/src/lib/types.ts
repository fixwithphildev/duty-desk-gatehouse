export type MDRole = "maintenance_technician" | "maintenance_supervisor" | "maintenance_manager" | "head_of_operations" | "super_admin";

export const MD_ROLE_LABELS: Record<MDRole, string> = {
  maintenance_technician: "Technician",
  maintenance_supervisor: "Maintenance Supervisor",
  maintenance_manager: "Maintenance Manager",
  head_of_operations: "Head of Operations",
  super_admin: "Admin (IT)",
};

// The six maintenance units. Every job, request and purchase belongs to one.
export const MD_UNITS = ["General Maintenance", "Electrician", "Plumbing & Building", "Painting", "Welding", "HVAC"] as const;
export type MDUnit = (typeof MD_UNITS)[number];
export const isUnit = (s: string | null | undefined): s is MDUnit => !!s && (MD_UNITS as readonly string[]).includes(s);
export const UNIT_SHORT: Record<MDUnit, string> = { "General Maintenance": "GEN", Electrician: "ELEC", "Plumbing & Building": "PLMB", Painting: "PAINT", Welding: "WELD", HVAC: "HVAC" };
export const UNIT_COLOR: Record<string, string> = {
  "General Maintenance": "var(--cat1)",
  Electrician: "var(--cat3)",
  "Plumbing & Building": "var(--cat2)",
  Painting: "var(--cat4)",
  Welding: "var(--cat5)",
  HVAC: "var(--cat6)",
};
// Tickets filed before the units existed say "Engineering": they need a unit.
export const LEGACY_UNITS = ["Engineering"];

// Who can do what (the user's decision, 9 Oct 2026):
//  - Admin: everything, including staff accounts.
//  - Supervisor: everything except staff accounts.
//  - Maintenance Manager and Head of Operations: see every page, money
//    included, and change nothing.
//  - Technician: every unit's jobs and requests (start, finish, photos, log a
//    request), but no voiding, assigning units, money pages or staff accounts.

// Supervisor and Admin run the desk: assigning units, voiding mistakes,
// reopening a job, and recording costs and money from Finance.
export const MD_MANAGE_ROLES: MDRole[] = ["maintenance_supervisor", "super_admin"];
// The money pages (Costs, Funding, Spending). The Manager and Head of Operations only look.
export const MD_MONEY_ROLES: MDRole[] = [...MD_MANAGE_ROLES, "maintenance_manager", "head_of_operations"];
// Who starts and finishes jobs (recording who did it and when), on any unit.
export const MD_WORK_ROLES: MDRole[] = [...MD_MANAGE_ROLES, "maintenance_technician"];
// Who logs a new request.
export const MD_REQUEST_ROLES: MDRole[] = [...MD_MANAGE_ROLES, "maintenance_technician"];
// Who can open Staff Accounts (to look; only the Admin changes anything there).
export const MD_STAFF_VIEW_ROLES: MDRole[] = ["super_admin", "maintenance_supervisor", "maintenance_manager", "head_of_operations"];

const ALL_ROLES: MDRole[] = ["maintenance_technician", "maintenance_supervisor", "maintenance_manager", "head_of_operations", "super_admin"];

// Only the Admin creates accounts (the user's decision, Oct 2026).
export function creatableRolesFor(actorRole: MDRole): MDRole[] {
  return actorRole === "super_admin" ? ALL_ROLES : [];
}

// Accounts this role can reset, unlock and switch off: the Admin only, as in Duty Desk.
export function manageableRolesFor(actorRole: MDRole): MDRole[] {
  return actorRole === "super_admin" ? ALL_ROLES : [];
}

export function canManageAccount(actorRole: MDRole, targetRole: MDRole): boolean {
  return manageableRolesFor(actorRole).includes(targetRole);
}

export interface StaffAccount {
  id: string;
  username: string;
  display_name: string;
  role: MDRole;
  unit: string | null;
  disabled: boolean;
  must_change_code: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

// These values are dictated by the shared maintenance_tickets table (Duty
// Desk's dd_priority / dd_ticket_status enums); they must match exactly.
export const MD_TICKET_STATUSES = ["Reported", "In Progress", "Resolved"] as const;
export type TicketStatus = (typeof MD_TICKET_STATUSES)[number];
export const MD_PRIORITIES = ["Low", "Medium", "High"] as const;
export type TicketPriority = (typeof MD_PRIORITIES)[number];

// Who can ask for work through a request.
export const REQUEST_ROLES = ["Maintenance team", "CEO", "COO", "General Manager", "Head of Operations", "Head of Security", "Front desk", "Other"];
// Places outside the apartments that work is often asked for.
export const COMMON_AREAS = ["Main gate", "Back gate", "Office block", "Staff quarters", "Lobby", "Car park", "Generator house", "Pool deck", "Main Building corridor", "Studio Wings corridor"];

// All maintenance spending is recorded and reported in Naira.
const NAIRA = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
export function formatNaira(amount: number): string {
  return NAIRA.format(amount);
}

// MT-0042, from the ticket's running number.
export const ticketRef = (refNo: number | null | undefined) => (refNo ? `MT-${String(refNo).padStart(4, "0")}` : "MT-—");
