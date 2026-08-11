import Link from "next/link";
import { ClipboardCheck, MessageSquareWarning, Wrench, DoorClosed, ListTodo, BookOpen } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getLatestSubmittedByApartment } from "@/lib/data/checklists";
import { getComplaints } from "@/lib/data/complaints";
import { getMaintenanceTickets } from "@/lib/data/maintenance";
import { getPendingTasksCount } from "@/lib/data/tasks";
import { getLastHandover } from "@/lib/data/dutylog";
import { StatCard, Badge } from "@/components/ui";
import { priorityTone } from "@/lib/checklist-data";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  await requireSession();
  const [apts, complaints, tickets, pendingTasks, lastHandover] = await Promise.all([
    getLatestSubmittedByApartment(),
    getComplaints(),
    getMaintenanceTickets(),
    getPendingTasksCount(),
    getLastHandover(),
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

  return (
    <div className="view">
      <div className="view-head">
        <h2>Today&apos;s Duty Overview</h2>
        <span className="mono view-time">{new Date().toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {lastHandover ? (
        <div className="handover-banner">
          <BookOpen size={16} />
          <div>
            <div className="handover-title">Last shift handover — {lastHandover.officer_name}, {fmtTime(lastHandover.created_at)}</div>
            <div className="handover-note">{lastHandover.notes}</div>
          </div>
        </div>
      ) : null}

      <div className="stat-grid">
        <StatCard label="Apartments checked" value={apts.length} icon={ClipboardCheck} />
        <StatCard label="Not ready" value={notReady.length} icon={DoorClosed} tone={notReady.length ? "red" : "teal"} />
        <StatCard label="Open complaints" value={openComplaints.length} icon={MessageSquareWarning} tone={openComplaints.length ? "gold" : "teal"} />
        <StatCard label="Open maintenance" value={openTickets.length} icon={Wrench} tone={openTickets.length ? "gold" : "teal"} />
        <StatCard label="Pending tasks" value={pendingTasks} icon={ListTodo} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Apartments not ready for check-in</span></div>
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
            {activity.length === 0 ? <li style={{ padding: 12, opacity: 0.6, fontSize: 13 }}>No activity yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
