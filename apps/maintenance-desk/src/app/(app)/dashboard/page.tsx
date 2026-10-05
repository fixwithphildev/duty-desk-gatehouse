import Link from "next/link";
import { Wrench, AlertTriangle, Clock, CheckCircle2, Wallet } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { priorityTone, formatNaira, MD_CAN_VIEW_SPENDING } from "@/lib/types";
import { buildSpendingReport, periodStart, todayLocal } from "@/lib/reports/spending";
import { getTickets, getOpenTicketsCount, getHighPriorityOpenCount, getTicketsDailyTrend } from "@/lib/data/tickets";
import { StatCard, Badge, BarBreakdown } from "@/components/ui";
import { TrendChart } from "@/components/trend-chart";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  const session = await requireSession();
  const firstName = session.displayName.split(" ")[0];
  const canViewSpending = MD_CAN_VIEW_SPENDING.includes(session.role);
  const today = todayLocal();
  const [tickets, openCount, highPriorityCount, trend, monthSpend] = await Promise.all([
    getTickets(),
    getOpenTicketsCount(),
    getHighPriorityOpenCount(),
    getTicketsDailyTrend(14),
    canViewSpending ? buildSpendingReport("monthly", periodStart(today, "monthly"), today) : Promise.resolve(null),
  ]);

  const inProgress = tickets.filter((t) => t.status === "In Progress").length;
  const resolvedToday = tickets.filter((t) => t.status === "Resolved" && new Date(t.created_at).toDateString() === new Date().toDateString()).length;
  const recent = tickets.slice(0, 6);
  const byDept = [
    { label: "Engineering", value: tickets.filter((t) => t.assigned_to === "Engineering" && t.status !== "Resolved").length, tone: "orange" },
    { label: "General Maintenance", value: tickets.filter((t) => t.assigned_to === "General Maintenance" && t.status !== "Resolved").length, tone: "blue" },
  ];

  return (
    <div className="view">
      <div className="view-head dash-hero">
        <div>
          <div className="dash-hero-greeting">Welcome back, {firstName}</div>
          <h2>Ticket Queue Overview</h2>
        </div>
        <span className="mono view-time">{new Date().toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      <div className="stat-grid">
        <StatCard label="Open tickets" value={openCount} icon={Wrench} tone={openCount ? "orange" : "green"} />
        <StatCard label="High priority" value={highPriorityCount} icon={AlertTriangle} tone={highPriorityCount ? "red" : "green"} />
        <StatCard label="In progress" value={inProgress} icon={Clock} tone="blue" />
        <StatCard label="Resolved today" value={resolvedToday} icon={CheckCircle2} tone="green" />
        {monthSpend ? (
          <Link href="/spending" className="stat-card-link">
            <StatCard label="Spent this month" value={formatNaira(monthSpend.total)} icon={Wallet} tone="orange" sub={`${monthSpend.ticketCount} ticket${monthSpend.ticketCount === 1 ? "" : "s"}`} />
          </Link>
        ) : null}
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Open by department</span></div>
          <BarBreakdown items={byDept} />
        </div>
        <div className="card">
          <div className="card-head"><span>Recent activity</span></div>
          <ul className="feed">
            {recent.map((t) => (
              <li key={t.id}>
                <Link href="/tickets" className="feed-row">
                  <span className={`feed-dot tone-${priorityTone(t.priority)}`} />
                  <div className="feed-main">
                    <div className="feed-label">{t.issue_type} — {t.area}</div>
                    <div className="feed-meta mono">{t.assigned_to} · {fmtTime(t.created_at)}</div>
                  </div>
                  <Badge tone={t.status === "Resolved" ? "green" : t.status === "In Progress" ? "blue" : "orange"}>{t.status}</Badge>
                </Link>
              </li>
            ))}
            {recent.length === 0 ? <li style={{ padding: 12, opacity: 0.75, fontSize: 13 }}>No tickets yet.</li> : null}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Tickets logged — last 14 days</span></div>
        <TrendChart data={trend} tone="var(--orange)" />
      </div>
    </div>
  );
}
