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

// Who can do what (the user's decision, Oct 2026):
//  - Admin (super_admin): everything.
//  - Supervisor: everything except staff accounts.
//  - Resident Officer: everything except voiding and staff accounts.
//  - Resident Manager and General Manager: view the results, and void.
// Front desk, housekeeping and engineering keep their own narrow rights below.

// Only the Admin creates accounts, resets a usercode, unlocks or switches an
// account off.
export const DD_ADMIN_ROLES: DDRole[] = ["super_admin"];

// Roles that can open the Staff Accounts page. The Supervisor and the managers
// can see who has an account but can't change any. Resident Officers don't see it.
export const DD_STAFF_VIEW_ROLES: DDRole[] = ["super_admin", "supervisor", "resident_manager", "general_manager"];

// Roles that may create/edit each module. Everyone with a login can view
// everything; these gate the create/edit actions. The managers are left out of
// every one: they look at the results, they don't operate day-to-day.
export const DD_CAN_EDIT_CHECKLISTS: DDRole[] = ["resident_officer", "supervisor", "super_admin"];
export const DD_CAN_EDIT_COMPLAINTS: DDRole[] = ["resident_officer", "supervisor", "front_desk", "super_admin"];
export const DD_CAN_EDIT_TICKETS: DDRole[] = ["resident_officer", "supervisor", "housekeeping", "engineering", "super_admin"];
export const DD_CAN_EDIT_DUTY_LOG: DDRole[] = ["resident_officer", "supervisor", "super_admin"];
export const DD_CAN_EDIT_RESIDENTS: DDRole[] = ["resident_officer", "supervisor", "super_admin"];
export const DD_CAN_EDIT_TASKS: DDRole[] = ["resident_officer", "supervisor", "super_admin"];
// Front desk charges guests for damage found at check-out, and marks it charged.
export const DD_CAN_CHARGE_DAMAGE: DDRole[] = ["front_desk", "resident_officer", "supervisor", "super_admin"];

// Voiding a mistaken record is a correction with real accountability weight:
// the Admin, the Supervisor and the managers can; Resident Officers can't.
export const DD_CAN_VOID: DDRole[] = ["supervisor", "resident_manager", "general_manager", "super_admin"];

export const DD_STAFF_ROLES: DDRole[] = ["resident_officer", "front_desk", "housekeeping", "engineering"];
const ALL_ROLES: DDRole[] = ["resident_officer", "supervisor", "resident_manager", "front_desk", "housekeeping", "engineering", "general_manager", "super_admin"];

export function creatableRolesFor(actorRole: DDRole): DDRole[] {
  return actorRole === "super_admin" ? ALL_ROLES : [];
}

// Accounts this role can reset, unlock and switch off (the Admin only).
export function manageableRolesFor(actorRole: DDRole): DDRole[] {
  return actorRole === "super_admin" ? ALL_ROLES : [];
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
  // Which department the flagged item's ticket goes to (the officer's choice).
  dept?: string | null;
}
