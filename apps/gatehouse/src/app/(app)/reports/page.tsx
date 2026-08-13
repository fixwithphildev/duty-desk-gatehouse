import { AlertTriangle, Shield, Bell, Download } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { getIncidents, getIncidentsDailyTrend } from "@/lib/data/incidents";
import { getPatrols } from "@/lib/data/patrols";
import { getAlerts, getAlertsDailyTrend } from "@/lib/data/alerts";
import { StatCard, BarBreakdown } from "@/components/ui";
import { TrendChart } from "@/components/trend-chart";
import { EmailReportButton } from "./email-report-button";

export default async function ReportsPage() {
  await requirePageAccess("/reports");
  const [incidents, patrols, alerts, incidentsTrend, alertsTrend] = await Promise.all([
    getIncidents(),
    getPatrols(),
    getAlerts(),
    getIncidentsDailyTrend(14),
    getAlertsDailyTrend(14),
  ]);

  return (
    <div className="view">
      <div className="view-head"><h2>Reports</h2></div>
      <div className="stat-grid">
        <StatCard label="Total incidents" value={incidents.length} icon={AlertTriangle} />
        <StatCard label="Total patrols" value={patrols.length} icon={Shield} />
        <StatCard label="Alerts raised" value={alerts.length} icon={Bell} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Incidents by status</span></div>
          <BarBreakdown
            items={[
              { label: "Open", value: incidents.filter((i) => i.status === "Open").length, tone: "red" },
              { label: "In Progress", value: incidents.filter((i) => i.status === "In Progress").length, tone: "amber" },
              { label: "Resolved", value: incidents.filter((i) => i.status === "Resolved").length, tone: "green" },
            ]}
          />
        </div>
        <div className="card">
          <div className="card-head"><span>Incidents by severity</span></div>
          <BarBreakdown
            items={[
              { label: "Low", value: incidents.filter((i) => i.severity === "Low").length, tone: "green" },
              { label: "Medium", value: incidents.filter((i) => i.severity === "Medium").length, tone: "amber" },
              { label: "High", value: incidents.filter((i) => i.severity === "High").length, tone: "orange" },
              { label: "Critical", value: incidents.filter((i) => i.severity === "Critical").length, tone: "red" },
            ]}
          />
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Incidents logged — last 14 days</span></div>
          <TrendChart data={incidentsTrend} tone="var(--amber)" />
        </div>
        <div className="card">
          <div className="card-head"><span>Alerts raised — last 14 days</span></div>
          <TrendChart data={alertsTrend} tone="var(--red)" />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Download records</span></div>
        <p className="gate-copy" style={{ marginTop: -8 }}>Full record exports — CSV opens in Excel or Google Sheets; Email sends a copy as an attachment.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/reports/export/incidents"><Download size={14} /> <AlertTriangle size={14} /> Incidents</a>
            <EmailReportButton dataset="incidents" label="Incidents" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/reports/export/patrols"><Download size={14} /> <Shield size={14} /> Patrols</a>
            <EmailReportButton dataset="patrols" label="Patrols" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href="/reports/export/alerts"><Download size={14} /> <Bell size={14} /> Alerts</a>
            <EmailReportButton dataset="alerts" label="Alerts" />
          </div>
        </div>
      </div>
    </div>
  );
}
