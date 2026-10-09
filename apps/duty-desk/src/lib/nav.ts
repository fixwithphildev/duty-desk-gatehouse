import { DD_STAFF_VIEW_ROLES, type DDRole } from "./types";

export type NavKey =
  | "dashboard" | "board" | "checklists" | "complaints" | "maintenance" | "tasks"
  | "dutylog" | "residents" | "reports" | "frontdesk" | "admin" | "account";

export interface NavItem {
  href: string;
  label: string;
  iconKey: NavKey;
  group: "Operations" | "Records" | "Insights" | "Admin";
}

// Same order and groups as the Operations Suite design.
export const DD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconKey: "dashboard", group: "Operations" },
  { href: "/board", label: "Readiness Board", iconKey: "board", group: "Operations" },
  { href: "/frontdesk", label: "Can I sell it?", iconKey: "frontdesk", group: "Operations" },
  { href: "/checklists", label: "Checklists", iconKey: "checklists", group: "Operations" },
  { href: "/complaints", label: "Complaints", iconKey: "complaints", group: "Operations" },
  { href: "/maintenance", label: "Maintenance", iconKey: "maintenance", group: "Operations" },
  { href: "/tasks", label: "Tasks", iconKey: "tasks", group: "Operations" },
  { href: "/dutylog", label: "Duty Log", iconKey: "dutylog", group: "Records" },
  { href: "/residents", label: "Residents", iconKey: "residents", group: "Records" },
  { href: "/reports", label: "Reports", iconKey: "reports", group: "Insights" },
  { href: "/admin/staff", label: "Staff Accounts", iconKey: "admin", group: "Admin" },
  { href: "/account", label: "My Account", iconKey: "account", group: "Admin" },
];

const OFFICE = ["/dashboard", "/board", "/frontdesk", "/checklists", "/complaints", "/maintenance", "/tasks", "/dutylog", "/residents", "/reports", "/account"];

// Which top-level pages each role may reach at all, per blueprint 4.3.
// Dashboard and Account are always reachable so there's always a safe landing page
// (front desk's dashboard sends them on to the "Can I sell it?" page).
export const DD_ROLE_ALLOWED_PREFIXES: Record<DDRole, string[]> = {
  resident_officer: OFFICE,
  supervisor: [...OFFICE, "/admin"],
  resident_manager: [...OFFICE, "/admin"],
  general_manager: [...OFFICE, "/admin"],
  super_admin: [...OFFICE, "/admin"],
  front_desk: ["/dashboard", "/frontdesk", "/complaints", "/account"],
  housekeeping: ["/dashboard", "/maintenance", "/tasks", "/account"],
  engineering: ["/dashboard", "/maintenance", "/account"],
};

export function isPathAllowed(role: DDRole, pathname: string): boolean {
  return DD_ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

// Front desk's home is the "Can I sell it?" page, so their Dashboard link is hidden.
// Officers get the Readiness Board instead; the front desk page stays reachable for
// them by its address (linked from the board) but isn't in their menu.
export function navForRole(role: DDRole): NavItem[] {
  return DD_NAV.filter(
    (item) =>
      isPathAllowed(role, item.href) &&
      (item.iconKey !== "admin" || DD_STAFF_VIEW_ROLES.includes(role)) &&
      (item.iconKey !== "frontdesk" || role === "front_desk") &&
      !(role === "front_desk" && item.iconKey === "dashboard")
  );
}

// Page name for the top bar, from the current path.
export function pageTitle(pathname: string): string {
  if (pathname.startsWith("/checklists/new")) return "New checklist";
  const item = DD_NAV.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.label ?? "Duty Desk";
}
