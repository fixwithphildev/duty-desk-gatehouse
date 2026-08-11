import { AlertTriangle, Shield, KeyRound, Bell } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { getIncidents } from "@/lib/data/incidents";
import { getPatrols } from "@/lib/data/patrols";
import { getKeyRecords } from "@/lib/data/keys";
import { getAlerts } from "@/lib/data/alerts";
import { StatCard } from "@/components/ui";

export default async function ReportsPage() {
  await requirePageAccess("/reports");
  const [incidents, patrols, keys, alerts] = await Promise.all([getIncidents(), getPatrols(), getKeyRecords(), getAlerts()]);

  return (
    <div className="view">
      <div className="view-head"><h2>Reports</h2></div>
      <div className="stat-grid">
        <StatCard label="Total incidents" value={incidents.length} icon={AlertTriangle} />
        <StatCard label="Total patrols" value={patrols.length} icon={Shield} />
        <StatCard label="Keys currently issued" value={keys.filter((k) => k.status === "Issued").length} icon={KeyRound} />
        <StatCard label="Alerts raised" value={alerts.length} icon={Bell} />
      </div>
      <div className="card">
        <div className="card-head"><span>Incidents by status</span></div>
        <div className="stat-grid">
          {(["Open", "In Progress", "Resolved"] as const).map((status) => (
            <StatCard key={status} label={status} value={incidents.filter((i) => i.status === status).length} icon={AlertTriangle} />
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><span>Incidents by severity</span></div>
        <div className="stat-grid">
          {(["Low", "Medium", "High", "Critical"] as const).map((severity) => (
            <StatCard key={severity} label={severity} value={incidents.filter((i) => i.severity === severity).length} icon={AlertTriangle} />
          ))}
        </div>
      </div>
    </div>
  );
}
