"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardCheck, MessageSquareWarning, Wrench, BookOpen,
  Users, ListTodo, FileBarChart, Home, ShieldCheck, LogOut, UserCog,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { DD_ROLE_LABELS, type DDRole } from "@/lib/types";
import { signOutAction } from "@/app/(app)/sign-out-action";

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

  return (
    <aside className="sidebar">
      <div className="brand">
        <Home size={17} />
        <span className="brand-text">DUTY DESK</span>
      </div>
      <nav className="nav">
        {items.map((item) => {
          const Icon = ICONS[item.iconKey];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-active" : ""}`}>
              <Icon size={16} />
              <span>{item.label}</span>
              {item.iconKey === "checklists" && notReadyCount > 0 ? <span className="nav-dot" /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="user-avatar mono">{displayName[0]?.toUpperCase() ?? "?"}</div>
          <div>
            <div className="user-name">{displayName}</div>
            <div className="user-role">{DD_ROLE_LABELS[role]}</div>
          </div>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="signout-btn" title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}
