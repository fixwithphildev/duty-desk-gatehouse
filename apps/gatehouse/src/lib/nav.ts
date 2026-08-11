import type { GHRole } from "./types";

export interface NavItem {
  href: string;
  label: string;
  iconKey: "dashboard" | "incidents" | "vehicles" | "items" | "attendance" | "offduty" | "patrols" | "keys" | "alerts" | "reports" | "admin" | "account";
}

export const GH_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconKey: "dashboard" },
  { href: "/incidents", label: "Incidents", iconKey: "incidents" },
  { href: "/vehicles", label: "Vehicle Access", iconKey: "vehicles" },
  { href: "/items", label: "Items Book", iconKey: "items" },
  { href: "/attendance", label: "Staff Attendance", iconKey: "attendance" },
  { href: "/offduty", label: "Off-Duty Attendance", iconKey: "offduty" },
  { href: "/patrols", label: "Patrols", iconKey: "patrols" },
  { href: "/keys", label: "Access & Keys", iconKey: "keys" },
  { href: "/alerts", label: "Alerts", iconKey: "alerts" },
  { href: "/reports", label: "Reports", iconKey: "reports" },
  { href: "/admin/staff", label: "Staff Accounts", iconKey: "admin" },
  { href: "/account", label: "My Account", iconKey: "account" },
];

const CORE_PREFIXES = [
  "/dashboard", "/incidents", "/vehicles", "/items", "/attendance", "/offduty",
  "/patrols", "/keys", "/alerts", "/reports", "/account",
];

// Everyone with a login can view everything on Gatehouse (blueprint 4.3 —
// only edit rights and account admin differ by role), so every role gets
// the same page set except /admin, which is Supervisor/Super Admin only.
export const GH_ROLE_ALLOWED_PREFIXES: Record<GHRole, string[]> = {
  security_officer: CORE_PREFIXES,
  management: CORE_PREFIXES,
  security_supervisor: [...CORE_PREFIXES, "/admin"],
  super_admin: [...CORE_PREFIXES, "/admin"],
};

export function isPathAllowed(role: GHRole, pathname: string): boolean {
  return GH_ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function navForRole(role: GHRole): NavItem[] {
  return GH_NAV.filter((item) => isPathAllowed(role, item.href) && (item.iconKey !== "admin" || role === "security_supervisor" || role === "super_admin"));
}
