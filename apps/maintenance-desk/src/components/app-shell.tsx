"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Columns3, Inbox, Receipt, Banknote, BarChart3, ShieldCheck, UserCog, Search, Menu, LogOut, Wrench, Moon, Sun,
} from "lucide-react";
import { pageTitle, type NavItem, type NavKey } from "@/lib/nav";
import { signOutAction } from "@/app/(app)/sign-out-action";
import { toggleTheme } from "@/components/theme-toggle";
import { CommandPalette, type PaletteItem } from "@/components/command-palette";
import { Notifications } from "@/components/notifications";
import { KeepAlive } from "@/components/keep-alive";

const ICONS: Record<NavKey, typeof Wrench> = {
  dashboard: LayoutDashboard,
  board: Columns3,
  requests: Inbox,
  costs: Receipt,
  funding: Banknote,
  spending: BarChart3,
  admin: ShieldCheck,
  account: UserCog,
};

const GROUPS: NavItem["group"][] = ["Work", "Money", "Admin"];

export interface NavCount {
  n: number;
  // "hot" counts need attention (shown red unless you're on that page).
  hot?: boolean;
}

function lagosNow(): Date {
  // A Date whose UTC fields read as Lagos wall-clock time (Lagos is UTC+1, no DST).
  return new Date(Date.now() + 60 * 60 * 1000);
}

function clockNow(): string {
  const now = lagosNow();
  const day = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getUTCDay()];
  const mon = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][now.getUTCMonth()];
  return `${day} ${String(now.getUTCDate()).padStart(2, "0")} ${mon} · ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({
  items,
  counts,
  displayName,
  roleLabel,
  unitLine,
  search,
  children,
}: {
  items: NavItem[];
  counts: Partial<Record<NavKey, NavCount>>;
  displayName: string;
  roleLabel: string;
  unitLine: string;
  search: PaletteItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The clock is filled in after the first render so server and browser agree.
  const [clock, setClock] = useState("");

  useEffect(() => { setNavOpen(false); }, [pathname]);
  useEffect(() => {
    const tick = () => setClock(clockNow());
    tick();
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className={`app p-md ${navOpen ? "nav-open" : ""}`}>
      <aside className="side" aria-label="Maintenance Desk navigation">
        <div className="brand">
          <div className="bm"><Wrench size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><b>Maintenance Desk</b><span>The Destination</span></div>
        </div>
        <div className="shift">
          <div className="r"><span className="live" />Maintenance</div>
          <div className="s">{unitLine}</div>
        </div>
        <nav aria-label="Main">
          {GROUPS.map((g) => {
            const list = items.filter((i) => i.group === g);
            if (list.length === 0) return null;
            return (
              <div key={g}>
                <div className="ngroup">{g}</div>
                {list.map((item) => {
                  const Icon = ICONS[item.iconKey];
                  const active = isActive(pathname, item.href);
                  const c = counts[item.iconKey];
                  return (
                    <Link key={item.href} href={item.href} className="nav" aria-current={active ? "page" : undefined}>
                      <Icon size={18} />
                      <span>{item.label}</span>
                      {c && c.n > 0 ? <span className={`ct ${c.hot && !active ? "hot" : ""}`}>{c.n}</span> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="grow" />
        <div className="me">
          <Link href="/account" className="av" aria-label="My account" style={{ textDecoration: "none" }}>{initials}</Link>
          <div><b>{displayName}</b><span>{roleLabel}</span></div>
          <form action={signOutAction}>
            <button type="submit" className="icon-btn" style={{ width: 32, height: 32, border: 0 }} title="Sign out" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} />
      <div className="mainc">
        <div className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
          <div className="crumb"><span>Maintenance Desk</span><span style={{ color: "var(--text-4)" }}>/</span><b>{pageTitle(pathname)}</b></div>
          <div className="sp" />
          <button type="button" className="search" onClick={() => setPaletteOpen(true)} aria-label="Search">
            <Search size={16} /><span>Search jobs, requests, pages…</span><span className="kbd">Ctrl K</span>
          </button>
          <span className="clock" suppressHydrationWarning>{clock}</span>
          <button type="button" className="icon-btn theme-switch" onClick={toggleTheme} aria-label="Switch between light and dark mode" title="Light / dark">
            <Moon size={17} className="icon-moon" /><Sun size={17} className="icon-sun" />
          </button>
          <Notifications />
        </div>
        <main className="content" id="main">{children}</main>
      </div>
      <KeepAlive />
      {paletteOpen ? <CommandPalette items={search} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
