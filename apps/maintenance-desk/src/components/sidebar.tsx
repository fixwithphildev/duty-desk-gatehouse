"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Wrench, ShieldCheck, LogOut, UserCog, Menu, X,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { MD_ROLE_LABELS, type MDRole } from "@/lib/types";
import { signOutAction } from "@/app/(app)/sign-out-action";

const ICONS = {
  dashboard: LayoutDashboard,
  tickets: Wrench,
  admin: ShieldCheck,
  account: UserCog,
};

export function Sidebar({
  items,
  displayName,
  role,
  openTicketCount,
}: {
  items: NavItem[];
  displayName: string;
  role: MDRole;
  openTicketCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      <header className="mobile-topbar">
        <button className="menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={18} />
        </button>
        <div className="mobile-topbar-brand">
          <Wrench size={15} />
          <span className="mobile-topbar-brand-text">MAINTENANCE DESK</span>
        </div>
        <div style={{ width: 30 }} aria-hidden />
      </header>
      {open ? <div className="sidebar-overlay" onClick={() => setOpen(false)} /> : null}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <Wrench size={18} />
          <div>
            <span className="brand-text">MAINTENANCE DESK</span>
            <div className="brand-eyebrow">The Destination</div>
          </div>
          <button className="sidebar-close-btn icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <nav className="nav">
          {items.map((item) => {
            const Icon = ICONS[item.iconKey];
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-active" : ""}`}>
                <Icon size={16} />
                <span>{item.label}</span>
                {item.iconKey === "tickets" && openTicketCount > 0 ? <span className="nav-dot" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="user-avatar mono">{displayName[0]?.toUpperCase() ?? "?"}</div>
            <div>
              <div className="user-name">{displayName}</div>
              <div className="user-role">{MD_ROLE_LABELS[role]}</div>
            </div>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="signout-btn" title="Sign out" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
