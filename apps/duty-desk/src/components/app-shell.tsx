"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, LayoutGrid, DoorOpen, ClipboardCheck, MessageSquareWarning, Wrench, ListTodo,
  BookOpen, Users, BarChart3, ShieldCheck, UserCog, Search, Menu, LogOut, Home, Moon, Sun,
} from "lucide-react";
import { pageTitle, type NavItem, type NavKey } from "@/lib/nav";
import { signOutAction } from "@/app/(app)/sign-out-action";
import { toggleTheme } from "@/components/theme-toggle";
import { CommandPalette, type PaletteItem } from "@/components/command-palette";
import { Notifications } from "@/components/notifications";

const ICONS: Record<NavKey, typeof Home> = {
  dashboard: LayoutDashboard,
  board: LayoutGrid,
  frontdesk: DoorOpen,
  checklists: ClipboardCheck,
  complaints: MessageSquareWarning,
  maintenance: Wrench,
  tasks: ListTodo,
  dutylog: BookOpen,
  residents: Users,
  reports: BarChart3,
  admin: ShieldCheck,
  account: UserCog,
};

const GROUPS: NavItem["group"][] = ["Operations", "Records", "Insights", "Admin"];

export interface NavCount {
  n: number;
  // "hot" counts need attention (shown red unless you're on that page).
  hot?: boolean;
}

// Duty shifts at the property (Lagos time): morning 07–15, afternoon 15–23, night 23–07.
const SHIFTS = [
  { name: "Morning shift", from: 7, to: 15 },
  { name: "Afternoon shift", from: 15, to: 23 },
  { name: "Night shift", from: 23, to: 31 },
];

function lagosNow(): Date {
  // A Date whose UTC fields read as Lagos wall-clock time (Lagos is UTC+1, no DST).
  return new Date(Date.now() + 60 * 60 * 1000);
}

function shiftNow() {
  const now = lagosNow();
  let h = now.getUTCHours() + now.getUTCMinutes() / 60;
  if (h < 7) h += 24;
  const s = SHIFTS.find((x) => h >= x.from && h < x.to) ?? SHIFTS[0];
  const left = Math.max(0, s.to - h);
  const fmt = (x: number) => `${String(x % 24).padStart(2, "0")}:00`;
  return {
    name: s.name,
    hours: `${fmt(s.from)} – ${fmt(s.to)}`,
    left: `${Math.floor(left)}h ${String(Math.round((left % 1) * 60)).padStart(2, "0")}m left`,
    done: (h - s.from) / (s.to - s.from),
  };
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
  search,
  children,
}: {
  items: NavItem[];
  counts: Partial<Record<NavKey, NavCount>>;
  displayName: string;
  roleLabel: string;
  search: PaletteItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Clock and shift are filled in after the first render so server and browser agree.
  const [clock, setClock] = useState("");
  const [shift, setShift] = useState<ReturnType<typeof shiftNow> | null>(null);

  useEffect(() => { setNavOpen(false); }, [pathname]);
  useEffect(() => {
    const tick = () => { setClock(clockNow()); setShift(shiftNow()); };
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
    <div className={`app p-dd ${navOpen ? "nav-open" : ""}`}>
      <aside className="side" aria-label="Duty Desk navigation">
        <div className="brand">
          <div className="bm"><Home size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><b>Duty Desk</b><span>The Destination</span></div>
        </div>
        <div className="shift" aria-live="off">
          <div className="r"><span className="live" />On shift<span className="mono">{shift?.left ?? ""}</span></div>
          <div className="s">{shift ? `${shift.name} · ${shift.hours}` : " "}</div>
          <div className="bar"><span style={{ width: `${Math.round((shift?.done ?? 0) * 100)}%` }} /></div>
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
          <div className="crumb"><span>Duty Desk</span><span style={{ color: "var(--text-4)" }}>/</span><b>{pageTitle(pathname)}</b></div>
          <div className="sp" />
          <button type="button" className="search" onClick={() => setPaletteOpen(true)} aria-label="Search">
            <Search size={16} /><span>Search apartments, pages…</span><span className="kbd">Ctrl K</span>
          </button>
          <span className="clock" suppressHydrationWarning>{clock}</span>
          <button type="button" className="icon-btn theme-switch" onClick={toggleTheme} aria-label="Switch between light and dark mode" title="Light / dark">
            <Moon size={17} className="icon-moon" /><Sun size={17} className="icon-sun" />
          </button>
          <Notifications />
        </div>
        <main className="content" id="main">{children}</main>
      </div>
      {paletteOpen ? <CommandPalette items={search} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
