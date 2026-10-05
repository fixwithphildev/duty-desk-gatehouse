import type { MDRole } from "./types";

export interface NavItem {
  href: string;
  label: string;
  iconKey: "dashboard" | "tickets" | "spending" | "admin" | "account";
}

export const MD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconKey: "dashboard" },
  { href: "/tickets", label: "Tickets", iconKey: "tickets" },
  { href: "/spending", label: "Spending Reports", iconKey: "spending" },
  { href: "/admin/staff", label: "Staff Accounts", iconKey: "admin" },
  { href: "/account", label: "My Account", iconKey: "account" },
];

const CORE_PREFIXES = ["/dashboard", "/tickets", "/account"];

export const MD_ROLE_ALLOWED_PREFIXES: Record<MDRole, string[]> = {
  maintenance_technician: CORE_PREFIXES,
  maintenance_supervisor: [...CORE_PREFIXES, "/spending", "/admin"],
  head_of_operations: [...CORE_PREFIXES, "/spending"],
  super_admin: [...CORE_PREFIXES, "/spending", "/admin"],
};

export function isPathAllowed(role: MDRole, pathname: string): boolean {
  return MD_ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function navForRole(role: MDRole): NavItem[] {
  return MD_NAV.filter((item) => isPathAllowed(role, item.href) && (item.iconKey !== "admin" || role === "maintenance_supervisor" || role === "super_admin"));
}
