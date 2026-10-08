import Link from "next/link";
import { ClipboardCheck, MessageSquareWarning, Wrench, DoorClosed, ListTodo, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { getLatestSubmittedByApartment, getChecklistsDailyTrend } from "@/lib/data/checklists";
import { getComplaints } from "@/lib/data/complaints";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { getPendingTasksCount } from "@/lib/data/tasks";
import { getLastHandover } from "@/lib/data/dutylog";
import { StatCard, Badge } from "@/components/ui";
import { TrendChart } from "@/components/trend-chart";
import { AutoRefresh } from "@/components/auto-refresh";
import { priorityTone } from "@/lib/checklist-data";
import { HandoverBanner } from "./handover-banner";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  const session = await requireSession();
  const firstName = session.displayName.split(" ")[0];
  const [apts, complaints, tickets, pendingTasks, lastHandover, checklistTrend] = await Promise.all([
    getLatestSubmittedByApartment(),
    getComplaints(),
    getMaintenanceTickets(),
    getPendingTasksCount(),
    getLastHandover(),
    getChecklistsDailyTrend(14),
  ]);

  const notReady = apts.filter((c) => !c.overall_ready);
  const openComplaints = complaints.filter((c) => c.status !== "Resolved");
  const openTickets = tickets.filter((t) => t.status !== "Resolved");

  const activity = [
    ...complaints.map((c) => ({ id: `c-${c.id}`, label: c.description, priority: c.priority, createdAt: c.created_at })),
    ...tickets.map((t) => ({ id: `t-${t.id}`, label: t.issue_type, priority: t.priority, createdAt: t.created_at })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Server time is UTC on Vercel; the property is in Lagos.
  const now = new Date();
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Lagos" }));
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const today = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
  const canCreateChecklist = DD_CAN_EDIT_CHECKLISTS.includes(session.role);

  return (
    <div className="view">
      <div className="dash-hero">
        <div>
          <div className="eyebrow">{today}</div>
          <h1>Good {partOfDay}, {firstName}</h1>
          <p className="dash-hero-sub">Here&apos;s what needs you on today&apos;s duty.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AutoRefresh />
          {canCreateChecklist ? (
            <Link href="/checklists/new" className="btn btn-primary"><Plus size={16} /> New checklist</Link>
          ) : null}
        </div>
      </div>

      <HandoverBanner handover={lastHandover} />

      <div className="stat-grid">
        <StatCard label="Apartments checked" value={apts.length} icon={ClipboardCheck} />
        <StatCard label="Not ready" value={notReady.length} icon={DoorClosed} tone={notReady.length ? "red" : "teal"} />
        <StatCard label="Open complaints" value={openComplaints.length} icon={MessageSquareWarning} tone={openComplaints.length ? "gold" : "teal"} />
        <StatCard label="Open maintenance" value={openTickets.length} icon={Wrench} tone={openTickets.length ? "gold" : "teal"} />
        <StatCard label="Pending tasks" value={pendingTasks} icon={ListTodo} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Not ready for check-in</span><Link href="/checklists" className="card-link">All checklists</Link></div>
          {notReady.length === 0 ? (
            <div className="empty-state"><ClipboardCheck size={26} strokeWidth={1.5} /><div className="empty-title">All checked apartments are ready</div></div>
          ) : (
            <ul className="feed">
              {notReady.map((c) => (
                <li key={c.id}>
                  <Link href="/checklists" className="feed-row">
                    <span className="feed-dot tone-red" />
                    <div className="feed-main">
                      <div className="feed-label">Apartment {c.apartment}</div>
                      <div className="feed-meta mono">{c.prepared_by_name} · {fmtTime(c.created_at)}</div>
                    </div>
                    <Badge tone="red">Not Ready</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-head"><span>Recent activity</span></div>
          <ul className="feed">
            {activity.map((f) => (
              <li key={f.id} className="feed-row feed-row-block">
                <span className={`feed-dot tone-${priorityTone(f.priority)}`} />
                <div className="feed-main">
                  <div className="feed-label">{f.label}</div>
                  <div className="feed-meta mono">{fmtTime(f.createdAt)}</div>
                </div>
              </li>
            ))}
            {activity.length === 0 ? <li style={{ padding: 12, opacity: 0.75, fontSize: 13 }}>No activity yet.</li> : null}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Checklists submitted — last 14 days</span></div>
        <TrendChart data={checklistTrend} tone="var(--teal)" />
      </div>
    </div>
  );
}
