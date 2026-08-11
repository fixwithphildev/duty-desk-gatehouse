"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, AlertTriangle, MapPin, ClipboardList, UserCheck, Users,
  Shield, KeyRound, Bell, FileBarChart, Radio, ShieldCheck, LogOut, UserCog,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { GH_ROLE_LABELS, type GHRole } from "@/lib/types";
import { signOutAction } from "@/app/(app)/sign-out-action";

const ICONS = {
  dashboard: LayoutDashboard,
  incidents: AlertTriangle,
  vehicles: MapPin,
  items: ClipboardList,
  attendance: UserCheck,
  offduty: Users,
  patrols: Shield,
  keys: KeyRound,
  alerts: Bell,
  reports: FileBarChart,
  admin: ShieldCheck,
  account: UserCog,
};

export function Sidebar({
  items,
  displayName,
  role,
  unackAlertCount,
}: {
  items: NavItem[];
  displayName: string;
  role: GHRole;
  unackAlertCount: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <Radio size={18} />
        <span className="brand-text">GATEHOUSE</span>
      </div>
      <nav className="nav">
        {items.map((item) => {
          const Icon = ICONS[item.iconKey];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? "nav-active" : ""}`}>
              <Icon size={16} />
              <span>{item.label}</span>
              {item.iconKey === "alerts" && unackAlertCount > 0 ? <span className="nav-dot" /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="user-avatar mono">{displayName[0]?.toUpperCase() ?? "?"}</div>
          <div>
            <div className="user-name">{displayName}</div>
            <div className="user-role">{GH_ROLE_LABELS[role]}</div>
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
