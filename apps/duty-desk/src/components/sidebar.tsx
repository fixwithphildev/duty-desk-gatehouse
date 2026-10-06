"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardCheck, MessageSquareWarning, Wrench, BookOpen,
  Users, ListTodo, FileBarChart, ShieldCheck, LogOut, UserCog, MoreHorizontal,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { DD_ROLE_LABELS, type DDRole } from "@/lib/types";
import { signOutAction } from "@/app/(app)/sign-out-action";
import { ThemeToggle, toggleTheme } from "@/components/theme-toggle";

const ICONS = {
  dashboard: LayoutDashboard,
  checklists: ClipboardCheck,
  complaints: MessageSquareWarning,
  maintenance: Wrench,
  dutylog: BookOpen,
  residents: Users,
  tasks: ListTodo,
  reports: FileBarChart,
  admin: ShieldCheck,
  account: UserCog,
};

// Sidebar groups. Each role only sees the items it's allowed (navForRole),
// and a group's heading only shows if the group has something in it.
const SECTIONS: { label: string | null; keys: NavItem["iconKey"][] }[] = [
  { label: null, keys: ["dashboard"] },
  { label: "Daily work", keys: ["checklists", "complaints", "maintenance", "dutylog", "tasks"] },
  { label: "Records", keys: ["residents", "reports"] },
  { label: "Settings", keys: ["admin", "account"] },
];

// Shorter labels for the phone tab bar, where space is tight.
const TAB_LABELS: Partial<Record<NavItem["iconKey"], string>> = { dashboard: "Home", dutylog: "Duty Log" };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  items,
  displayName,
  role,
  notReadyCount,
}: {
  items: NavItem[];
  displayName: string;
  role: DDRole;
  notReadyCount: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const initial = displayName[0]?.toUpperCase() ?? "?";
  const countFor = (item: NavItem) => (item.iconKey === "checklists" && notReadyCount > 0 ? notReadyCount : 0);

  const navLinks = (variant: "side" | "sheet") =>
    SECTIONS.map((section) => {
      const sectionItems = items.filter((i) => section.keys.includes(i.iconKey));
      if (sectionItems.length === 0) return null;
      return (
        <div key={section.label ?? "top"} style={{ display: "contents" }}>
          {section.label ? <div className="nav-section">{section.label}</div> : null}
          {sectionItems.map((item) => {
            const Icon = ICONS[item.iconKey];
            const count = countFor(item);
            return (
              <Link key={`${variant}-${item.href}`} href={item.href} className={`nav-item ${isActive(pathname, item.href) ? "nav-active" : ""}`}>
                <Icon size={18} />
                <span>{item.label}</span>
                {count ? <span className="nav-count" aria-label={`${count} not ready`}>{count}</span> : null}
              </Link>
            );
          })}
        </div>
      );
    });

  // Phone tab bar: the role's first four day-to-day pages, then "More" for
  // everything else plus account, theme and sign-out.
  const tabs = items.filter((i) => i.iconKey !== "admin" && i.iconKey !== "account").slice(0, 4);

  return (
    <>
      {/* Desktop */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <div className="brand-text">Duty Desk</div>
            <div className="brand-eyebrow">The Destination</div>
          </div>
        </div>
        <nav className="nav" aria-label="Main">{navLinks("side")}</nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="user-avatar">{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name">{displayName}</div>
              <div className="user-role">{DD_ROLE_LABELS[role]}</div>
            </div>
          </div>
          <ThemeToggle />
          <form action={signOutAction}>
            <button type="submit" className="signout-btn" title="Sign out" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </aside>

      {/* Phone & tablet */}
      <header className="mobile-topbar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div className="brand-text">Duty Desk</div>
        </div>
        <div className="mobile-topbar-actions">
          <ThemeToggle className="topbar-btn" />
          <button type="button" className="topbar-btn" style={{ borderRadius: "50%", padding: 0 }} onClick={() => setMoreOpen(true)} aria-label="Account and more">
            <span className="user-avatar" style={{ width: 42, height: 42 }}>{initial}</span>
          </button>
        </div>
      </header>

      <nav className="tabbar" aria-label="Main">
        {tabs.map((item) => {
          const Icon = ICONS[item.iconKey];
          const count = countFor(item);
          return (
            <Link key={`tab-${item.href}`} href={item.href} className={`tab ${isActive(pathname, item.href) ? "tab-active" : ""}`}>
              <Icon size={20} />
              <span>{TAB_LABELS[item.iconKey] ?? item.label}</span>
              {count ? <span className="tab-badge">{count}</span> : null}
            </Link>
          );
        })}
        <button type="button" className={`tab ${moreOpen ? "tab-active" : ""}`} onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen ? <div className="sidebar-overlay" onClick={() => setMoreOpen(false)} /> : null}
      <div className={`more-sheet ${moreOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!moreOpen}>
        <div className="sheet-grip" />
        <div className="sheet-user">
          <div className="user-avatar" style={{ width: 44, height: 44 }}>{initial}</div>
          <div>
            <div className="user-name" style={{ fontSize: 15 }}>{displayName}</div>
            <div className="user-role">{DD_ROLE_LABELS[role]}</div>
          </div>
        </div>
        <nav className="nav" aria-label="All pages">{navLinks("sheet")}</nav>
        <div className="sheet-actions">
          <button type="button" className="btn theme-toggle" onClick={toggleTheme}>
            <span className="icon-moon">Dark mode</span>
            <span className="icon-sun">Light mode</span>
          </button>
          <form action={signOutAction} style={{ display: "contents" }}>
            <button type="submit" className="btn"><LogOut size={16} /> Sign out</button>
          </form>
        </div>
      </div>
    </>
  );
}
