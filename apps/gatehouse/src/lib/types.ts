export type GHRole = "security_officer" | "security_supervisor" | "management" | "super_admin";

export const GH_ROLE_LABELS: Record<GHRole, string> = {
  security_officer: "Security Officer",
  security_supervisor: "Security Supervisor",
  management: "Management",
  super_admin: "Super Admin (IT)",
};

// Roles allowed to administer staff accounts (create, disable, reset codes).
export const GH_ADMIN_ROLES: GHRole[] = ["security_supervisor", "super_admin"];

// Per blueprint 4.3: Security Officer and Security Supervisor can log/edit
// operational records; Management is read-only oversight.
export const GH_CAN_EDIT: GHRole[] = ["security_officer", "security_supervisor", "super_admin"];

// Roles a Security Supervisor may create/manage day-to-day (blueprint 4.1).
// Super Admin can manage every role, including the Supervisor's own account.
export const GH_STAFF_ROLES: GHRole[] = ["security_officer"];

export function assignableRolesFor(actorRole: GHRole): GHRole[] {
  if (actorRole === "super_admin") return ["security_officer", "security_supervisor", "management", "super_admin"];
  if (actorRole === "security_supervisor") return GH_STAFF_ROLES;
  return [];
}

export function canManageAccount(actorRole: GHRole, targetRole: GHRole): boolean {
  if (actorRole === "super_admin") return true;
  if (actorRole === "security_supervisor") return GH_STAFF_ROLES.includes(targetRole);
  return false;
}

export interface StaffAccount {
  id: string;
  username: string;
  display_name: string;
  role: GHRole;
  disabled: boolean;
  must_change_code: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export type Severity = "Low" | "Medium" | "High" | "Critical";
export const GH_SEVERITIES: Severity[] = ["Low", "Medium", "High", "Critical"];

export function severityTone(s: string): string {
  return s === "Low" ? "green" : s === "Medium" ? "amber" : s === "High" ? "orange" : "red";
}
export function statusTone(s: string): string {
  return ["Resolved", "Returned", "Completed", "Checked Out", "Acknowledged", "Signed Out"].includes(s)
    ? "green"
    : ["Open", "Issued", "In Progress", "Signed In", "In"].includes(s)
      ? "amber"
      : "neutral";
}
