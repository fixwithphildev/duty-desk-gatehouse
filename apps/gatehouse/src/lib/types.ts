export type GHRole = "security_officer" | "security_supervisor" | "management" | "super_admin";

export const GH_ROLE_LABELS: Record<GHRole, string> = {
  security_officer: "Security Officer",
  security_supervisor: "Security Supervisor",
  management: "Management",
  super_admin: "Admin (IT)",
};

// Per blueprint 4.3: Security Officer and Security Supervisor log and update
// operational records; Management is read-only oversight.
export const GH_CAN_EDIT: GHRole[] = ["security_officer", "security_supervisor", "super_admin"];

// Voiding a mistaken record is a correction with real accountability weight,
// so it's reserved for a higher tier than routine logging: an officer can log
// and update records but not void them. This is Management's one write
// permission on this platform.
export const GH_CAN_VOID: GHRole[] = ["security_supervisor", "management", "super_admin"];

// Who can open Staff Accounts.
export const GH_STAFF_VIEW_ROLES: GHRole[] = ["security_supervisor", "super_admin"];

const ALL_ROLES: GHRole[] = ["security_officer", "security_supervisor", "management", "super_admin"];

// Only the Admin creates accounts (the user's decision, Oct 2026), as on
// Duty Desk and Maintenance Desk.
export function creatableRolesFor(actorRole: GHRole): GHRole[] {
  return actorRole === "super_admin" ? ALL_ROLES : [];
}

// Accounts this role can reset, unlock and switch off, so a forgotten code
// doesn't have to wait for the Admin.
export function manageableRolesFor(actorRole: GHRole): GHRole[] {
  if (actorRole === "super_admin") return ALL_ROLES;
  if (actorRole === "security_supervisor") return ["security_officer"];
  return [];
}

export function canManageAccount(actorRole: GHRole, targetRole: GHRole): boolean {
  return manageableRolesFor(actorRole).includes(targetRole);
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
// Severity colours used on every chart and badge (Critical is the only red).
export const SEV_COLOR: Record<Severity, string> = { Low: "var(--info)", Medium: "var(--warn)", High: "#E8822A", Critical: "var(--bad)" };
export const sevTone = (s: string) => (s === "Critical" || s === "High" ? "bad" : s === "Medium" ? "warn" : "info");

export type IncidentStatus = "Open" | "In Progress" | "Resolved";
export const GH_INCIDENT_STATUSES: IncidentStatus[] = ["Open", "In Progress", "Resolved"];
export const incTone = (s: string) => (s === "Resolved" ? "ok" : s === "In Progress" ? "info" : "warn");

export type AlertStatus = "Unacknowledged" | "Acknowledged" | "Resolved";

// A vehicle card out longer than this is overdue: usually a lost card or a
// car left overnight.
export const OVERDUE_MINUTES = 12 * 60;
export const DEFAULT_RACK_SIZE = 60;
export const MAX_RACK_SIZE = 300;

export const incRef = (n: number | null) => (n == null ? "" : `INC-${String(n).padStart(4, "0")}`);
export const cardNo = (c: string | number) => {
  const s = String(c).trim();
  return /^\d+$/.test(s) ? s.padStart(3, "0") : s.toUpperCase();
};
