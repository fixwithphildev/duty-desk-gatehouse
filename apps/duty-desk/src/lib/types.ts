export type DDRole =
  | "resident_officer"
  | "supervisor"
  | "resident_manager"
  | "front_desk"
  | "housekeeping"
  | "engineering"
  | "general_manager"
  | "super_admin";

export const DD_ROLE_LABELS: Record<DDRole, string> = {
  resident_officer: "Resident Officer",
  supervisor: "Supervisor",
  resident_manager: "Resident Manager",
  front_desk: "Front Desk",
  housekeeping: "Housekeeping",
  engineering: "Engineering",
  general_manager: "General Manager",
  super_admin: "Super Admin (IT)",
};

// Roles allowed to administer staff accounts (create, disable, reset codes).
export const DD_ADMIN_ROLES: DDRole[] = ["resident_manager", "general_manager", "super_admin"];

// Roles that can open the Staff Accounts page. Supervisor can see who has an
// account but can't create, reset or disable any (only the admin roles above).
export const DD_STAFF_VIEW_ROLES: DDRole[] = [...DD_ADMIN_ROLES, "supervisor"];

// Roles that may create/edit each module. Everyone with a login can view
// everything (per blueprint 4.3's "Can view: Everything" for most roles);
// these gate the create/edit actions. General Manager is deliberately
// excluded from every one of these — per the blueprint's own description
// of the role ("Read-only oversight, reports"), GM sees everything that's
// happening but doesn't operate day-to-day, the same way Gatehouse's
// Management role has no edit access either. GM keeps Void (below), since
// that's a correction/oversight action, not routine operational editing.
export const DD_CAN_EDIT_CHECKLISTS: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "super_admin"];
export const DD_CAN_EDIT_COMPLAINTS: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "front_desk", "super_admin"];
export const DD_CAN_EDIT_TICKETS: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "housekeeping", "engineering", "super_admin"];
export const DD_CAN_EDIT_DUTY_LOG: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "super_admin"];
export const DD_CAN_EDIT_RESIDENTS: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "super_admin"];
export const DD_CAN_EDIT_TASKS: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "super_admin"];
// Front desk charges guests for damage found at check-out, and marks it charged.
export const DD_CAN_CHARGE_DAMAGE: DDRole[] = ["front_desk", "resident_officer", "supervisor", "resident_manager", "super_admin"];

// Voiding a mistaken record is a correction with real accountability
// weight, so it's reserved for a higher tier than routine create/edit —
// Resident Officer can log and update records but not void them.
export const DD_CAN_VOID: DDRole[] = ["general_manager", "super_admin"];

// Only the Admin (super_admin) creates accounts, for every role (the user's
// decision, Oct 2026). The Resident Manager can still reset a usercode, unlock
// or switch off Supervisors and regular staff, and the General Manager regular
// staff, so a forgotten code doesn't have to wait for the Admin. Super Admin
// manages every role, including the managers' own accounts.
export const DD_STAFF_ROLES: DDRole[] = ["resident_officer", "front_desk", "housekeeping", "engineering"];
const RESIDENT_MANAGER_ROLES: DDRole[] = ["supervisor", ...DD_STAFF_ROLES];
const ALL_ROLES: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "front_desk", "housekeeping", "engineering", "general_manager", "super_admin"];

export function creatableRolesFor(actorRole: DDRole): DDRole[] {
  return actorRole === "super_admin" ? ALL_ROLES : [];
}

// Accounts this role can reset, unlock and switch off.
export function manageableRolesFor(actorRole: DDRole): DDRole[] {
  if (actorRole === "super_admin") return ALL_ROLES;
  if (actorRole === "resident_manager") return RESIDENT_MANAGER_ROLES;
  if (actorRole === "general_manager") return DD_STAFF_ROLES;
  return [];
}

export function canManageAccount(actorRole: DDRole, targetRole: DDRole): boolean {
  return manageableRolesFor(actorRole).includes(targetRole);
}

export interface StaffAccount {
  id: string;
  username: string;
  display_name: string;
  role: DDRole;
  disabled: boolean;
  must_change_code: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export type ChecklistType = "check_in_prep" | "check_out_inspection";
export type ChecklistStatus = "in_progress" | "submitted";
export type Condition = "Good" | "Damaged" | "Missing" | "N/A";

export interface ChecklistItemInput {
  name: string;
  category: string;
  kind: "condition" | "yesno";
  qty: string | null;
  condition: Condition | null;
  available: "Yes" | "No" | null;
  // What's wrong, for a flagged item. Goes on the maintenance ticket.
  note?: string | null;
}
