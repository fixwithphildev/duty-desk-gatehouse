export type DDRole =
  | "resident_officer"
  | "front_desk"
  | "housekeeping"
  | "engineering"
  | "general_manager"
  | "super_admin";

export const DD_ROLE_LABELS: Record<DDRole, string> = {
  resident_officer: "Resident Officer",
  front_desk: "Front Desk",
  housekeeping: "Housekeeping",
  engineering: "Engineering",
  general_manager: "General Manager",
  super_admin: "Super Admin (IT)",
};

// Roles allowed to administer staff accounts (create, disable, reset codes).
export const DD_ADMIN_ROLES: DDRole[] = ["general_manager", "super_admin"];

// Roles that may create/edit each module. Everyone with a login can view
// everything (per blueprint 4.3's "Can view: Everything" for most roles);
// these gate the create/edit actions. General Manager is deliberately
// excluded from every one of these — per the blueprint's own description
// of the role ("Read-only oversight, reports"), GM sees everything that's
// happening but doesn't operate day-to-day, the same way Gatehouse's
// Management role has no edit access either. GM keeps Void (below), since
// that's a correction/oversight action, not routine operational editing.
export const DD_CAN_EDIT_CHECKLISTS: DDRole[] = ["resident_officer", "super_admin"];
export const DD_CAN_EDIT_COMPLAINTS: DDRole[] = ["resident_officer", "front_desk", "super_admin"];
export const DD_CAN_EDIT_TICKETS: DDRole[] = ["resident_officer", "housekeeping", "engineering", "super_admin"];
export const DD_CAN_EDIT_DUTY_LOG: DDRole[] = ["resident_officer", "super_admin"];
export const DD_CAN_EDIT_RESIDENTS: DDRole[] = ["resident_officer", "super_admin"];
export const DD_CAN_EDIT_TASKS: DDRole[] = ["resident_officer", "super_admin"];

// Voiding a mistaken record is a correction with real accountability
// weight, so it's reserved for a higher tier than routine create/edit —
// Resident Officer can log and update records but not void them.
export const DD_CAN_VOID: DDRole[] = ["general_manager", "super_admin"];

// Roles a General Manager may create/manage day-to-day (blueprint 4.1: GM
// handles "day-to-day account creation for regular staff"). Super Admin can
// manage every role, including General Manager's own account.
export const DD_STAFF_ROLES: DDRole[] = ["resident_officer", "front_desk", "housekeeping", "engineering"];

export function assignableRolesFor(actorRole: DDRole): DDRole[] {
  if (actorRole === "super_admin") return ["resident_officer", "front_desk", "housekeeping", "engineering", "general_manager", "super_admin"];
  if (actorRole === "general_manager") return DD_STAFF_ROLES;
  return [];
}

export function canManageAccount(actorRole: DDRole, targetRole: DDRole): boolean {
  if (actorRole === "super_admin") return true;
  if (actorRole === "general_manager") return DD_STAFF_ROLES.includes(targetRole);
  return false;
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
}
