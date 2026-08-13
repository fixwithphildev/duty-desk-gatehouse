import { DoorOpen, DoorClosed, MessageSquareWarning, Wrench, ClipboardCheck, Download } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { getLatestSubmittedByApartment, getChecklistsDailyTrend } from "@/lib/data/checklists";
import { getComplaints, getComplaintsDailyTrend } from "@/lib/data/complaints";
import { getMaintenanceTickets, getTicketsDailyTrend } from "@/lib/data/maintenance";
import { StatCard, BarBreakdown } from "@/components/ui";
import { TrendChart } from "@/components/trend-chart";
import { EmailReportButton } from "./email-report-button";

export default async function ReportsPage() {
  await requirePageAccess("/reports");
  const [apts, complaints, tickets, complaintsTrend, ticketsTrend, checklistsTrend] = await Promise.all([
    getLatestSubmittedByApartment(),
    getComplaints(),
    getMaintenanceTickets(),
    getComplaintsDailyTrend(14),
    getTicketsDailyTrend(14),
    getChecklistsDailyTrend(14),
  ]);
  const ready = apts.filter((c) => c.overall_ready).length;

  return (
    <div className="view">
      <div className="view-head"><h2>Reports</h2></div>
      <div className="stat-grid">
        <StatCard label="Apartments Ready" value={ready} icon={DoorOpen} tone="teal" />
        <StatCard label="Apartments Not Ready" value={apts.length - ready} icon={DoorClosed} tone={apts.length - ready ? "red" : "teal"} />
        <StatCard label="Complaints logged" value={complaints.length} icon={MessageSquareWarning} />
        <StatCard label="Tickets logged" value={tickets.length} icon={Wrench} />
      </div>

      <div className="card">
        <div className="card-head"><span>Checklists submitted — last 14 days</span></div>
        <TrendChart data={checklistsTrend} tone="var(--teal)" />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Complaints by status</span></div>
          <BarBreakdown
            items={[
              { label: "Open", value: complaints.filter((c) => c.status === "Open").length, tone: "red" },
              { label: "In Progress", value: complaints.filter((c) => c.status === "In Progress").length, tone: "gold" },
              { label: "Resolved", value: complaints.filter((c) => c.status === "Resolved").length, tone: "teal" },
            ]}
          />
        </div>
        <div className="card">
          <div className="card-head"><span>Maintenance tickets by status</span></div>
          <BarBreakdown
            items={[
              { label: "Reported", value: tickets.filter((t) => t.status === "Reported").length, tone: "red" },
              { label: "In Progress", value: tickets.filter((t) => t.status === "In Progress").length, tone: "gold" },
              { label: "Resolved", value: tickets.filter((t) => t.status === "Resolved").length, tone: "teal" },
            ]}
          />
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Complaints logged — last 14 days</span></div>
          <TrendChart data={complaintsTrend} tone="var(--gold)" />
        </div>
        <div className="card">
          <div className="card-head"><span>Maintenance tickets logged — last 14 days</span></div>
          <TrendChart data={ticketsTrend} tone="var(--red)" />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Download records</span></div>
        <p className="gate-copy" style={{ marginTop: -8 }}>Full record exports — CSV opens in Excel or Google Sheets; Email sends a copy as an attachment.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/reports/export/checklists"><Download size={14} /> <ClipboardCheck size={14} /> Checklists</a>
            <EmailReportButton dataset="checklists" label="Checklists" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/reports/export/complaints"><Download size={14} /> <MessageSquareWarning size={14} /> Complaints</a>
            <EmailReportButton dataset="complaints" label="Complaints" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/reports/export/tickets"><Download size={14} /> <Wrench size={14} /> Maintenance Tickets</a>
            <EmailReportButton dataset="tickets" label="Maintenance Tickets" />
          </div>
        </div>
      </div>
    </div>
  );
}
