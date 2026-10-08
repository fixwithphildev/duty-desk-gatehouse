import { MD_STAFF_VIEW_ROLES, type MDRole } from "./types";

export type NavKey = "dashboard" | "board" | "requests" | "costs" | "funding" | "spending" | "admin" | "account";

export interface NavItem {
  href: string;
  label: string;
  iconKey: NavKey;
  group: "Work" | "Money" | "Admin";
}

// Same order and groups as the Operations Suite design.
export const MD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconKey: "dashboard", group: "Work" },
  { href: "/board", label: "Ticket Board", iconKey: "board", group: "Work" },
  { href: "/requests", label: "Requests", iconKey: "requests", group: "Work" },
  { href: "/costs", label: "Costs", iconKey: "costs", group: "Money" },
  { href: "/funding", label: "Funding", iconKey: "funding", group: "Money" },
  { href: "/spending", label: "Spending", iconKey: "spending", group: "Money" },
  { href: "/admin/staff", label: "Staff Accounts", iconKey: "admin", group: "Admin" },
  { href: "/account", label: "My Account", iconKey: "account", group: "Admin" },
];

const WORK = ["/dashboard", "/board", "/requests", "/tickets", "/account"];
const MONEY = ["/costs", "/funding", "/spending"];

// Technicians work the jobs; the money pages are for the Manager, Supervisor,
// Admin and (view only) Head of Operations.
export const MD_ROLE_ALLOWED_PREFIXES: Record<MDRole, string[]> = {
  maintenance_technician: WORK,
  head_of_operations: [...WORK, ...MONEY],
  maintenance_supervisor: [...WORK, ...MONEY, "/admin"],
  maintenance_manager: [...WORK, ...MONEY, "/admin"],
  super_admin: [...WORK, ...MONEY, "/admin"],
};

export function isPathAllowed(role: MDRole, pathname: string): boolean {
  return MD_ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function navForRole(role: MDRole): NavItem[] {
  return MD_NAV.filter((item) => isPathAllowed(role, item.href) && (item.iconKey !== "admin" || MD_STAFF_VIEW_ROLES.includes(role)));
}

export function pageTitle(pathname: string): string {
  const item = MD_NAV.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.label ?? "Maintenance Desk";
}
