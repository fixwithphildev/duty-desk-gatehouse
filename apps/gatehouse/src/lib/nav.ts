import { GH_STAFF_VIEW_ROLES, type GHRole } from "./types";

export type NavKey = "dashboard" | "gate" | "items" | "patrols" | "incidents" | "alerts" | "reports" | "admin" | "account";

export interface NavItem {
  href: string;
  label: string;
  iconKey: NavKey;
  group: "Operations" | "Insights" | "Admin";
}

// Same order and groups as the Operations Suite design.
export const GH_NAV: NavItem[] = [
  { href: "/dashboard", label: "Command", iconKey: "dashboard", group: "Operations" },
  { href: "/gate", label: "Gate Console", iconKey: "gate", group: "Operations" },
  { href: "/items", label: "Items Book", iconKey: "items", group: "Operations" },
  { href: "/patrols", label: "Patrols", iconKey: "patrols", group: "Operations" },
  { href: "/incidents", label: "Incidents", iconKey: "incidents", group: "Operations" },
  { href: "/alerts", label: "Alerts", iconKey: "alerts", group: "Operations" },
  { href: "/reports", label: "Reports", iconKey: "reports", group: "Insights" },
  { href: "/admin/staff", label: "Staff Accounts", iconKey: "admin", group: "Admin" },
  { href: "/account", label: "My Account", iconKey: "account", group: "Admin" },
];

const CORE = ["/dashboard", "/gate", "/vehicles", "/items", "/patrols", "/incidents", "/alerts", "/reports", "/account"];

// Everyone with a login can see everything on Gatehouse (blueprint 4.3: only
// edit rights and account admin differ by role), so every role gets the same
// pages except Staff Accounts, which is for the Security Supervisor and Admin.
export const GH_ROLE_ALLOWED_PREFIXES: Record<GHRole, string[]> = {
  security_officer: CORE,
  management: CORE,
  security_supervisor: [...CORE, "/admin"],
  super_admin: [...CORE, "/admin"],
};

export function isPathAllowed(role: GHRole, pathname: string): boolean {
  return GH_ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export function navForRole(role: GHRole): NavItem[] {
  return GH_NAV.filter((item) => isPathAllowed(role, item.href) && (item.iconKey !== "admin" || GH_STAFF_VIEW_ROLES.includes(role)));
}

export function pageTitle(pathname: string): string {
  const item = GH_NAV.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.label ?? "Gatehouse";
}
