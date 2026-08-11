import type { DDRole } from "./types";

export interface NavItem {
  href: string;
  label: string;
  iconKey: "dashboard" | "checklists" | "complaints" | "maintenance" | "dutylog" | "residents" | "tasks" | "reports" | "admin" | "account";
}

export const DD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconKey: "dashboard" },
  { href: "/checklists", label: "Checklists", iconKey: "checklists" },
  { href: "/complaints", label: "Complaints", iconKey: "complaints" },
  { href: "/maintenance", label: "Maintenance", iconKey: "maintenance" },
  { href: "/dutylog", label: "Duty Log", iconKey: "dutylog" },
  { href: "/residents", label: "Residents", iconKey: "residents" },
  { href: "/tasks", label: "Tasks", iconKey: "tasks" },
  { href: "/reports", label: "Reports", iconKey: "reports" },
  { href: "/admin/staff", label: "Staff Accounts", iconKey: "admin" },
  { href: "/account", label: "My Account", iconKey: "account" },
];

// Which top-level pages each role may reach at all, per blueprint 4.3.
// Dashboard and Account are always reachable so there's always a safe landing page.
export const DD_ROLE_ALLOWED_PREFIXES: Record<DDRole, string[]> = {
  resident_officer: ["/dashboard", "/checklists", "/complaints", "/maintenance", "/dutylog", "/residents", "/tasks", "/reports", "/account"],
  general_manager: ["/dashboard", "/checklists", "/complaints", "/maintenance", "/dutylog", "/residents", "/tasks", "/reports", "/admin", "/account"],
  super_admin: ["/dashboard", "/checklists", "/complaints", "/maintenance", "/dutylog", "/residents", "/tasks", "/reports", "/admin", "/account"],
  front_desk: ["/dashboard", "/checklists", "/complaints", "/account"],
  housekeeping: ["/dashboard", "/maintenance", "/tasks", "/account"],
  engineering: ["/dashboard", "/maintenance", "/account"],
};

export function isPathAllowed(role: DDRole, pathname: string): boolean {
  return DD_ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function navForRole(role: DDRole): NavItem[] {
  return DD_NAV.filter((item) => isPathAllowed(role, item.href) && (item.iconKey !== "admin" || role === "general_manager" || role === "super_admin"));
}
