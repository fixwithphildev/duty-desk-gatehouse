import Link from "next/link";
import { AlertTriangle, MapPin, Shield, KeyRound, Bell } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { severityTone } from "@/lib/types";
import { getIncidents, getOpenIncidentsCount } from "@/lib/data/incidents";
import { getVehiclesOnPropertyCount } from "@/lib/data/vehicles";
import { getActivePatrolsCount } from "@/lib/data/patrols";
import { getIssuedKeysCount } from "@/lib/data/keys";
import { getAlerts, getUnacknowledgedAlertsCount } from "@/lib/data/alerts";
import { Badge, StatCard } from "@/components/ui";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage() {
  await requireSession();
  const [incidents, openIncidents, vehiclesOn, activePatrols, issuedKeys, alerts, unackAlerts] = await Promise.all([
    getIncidents(),
    getOpenIncidentsCount(),
    getVehiclesOnPropertyCount(),
    getActivePatrolsCount(),
    getIssuedKeysCount(),
    getAlerts(),
    getUnacknowledgedAlertsCount(),
  ]);

  const unresolvedAlerts = alerts.filter((a) => a.status !== "Acknowledged").slice(0, 5);
  const recentIncidents = incidents.slice(0, 5);

  return (
    <div className="view">
      <div className="view-head">
        <h2>Shift Overview</h2>
        <span className="mono view-time">{new Date().toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      <div className="stat-grid">
        <StatCard label="Open incidents" value={openIncidents} icon={AlertTriangle} tone={openIncidents ? "amber" : "green"} />
        <StatCard label="Vehicles on property" value={vehiclesOn} icon={MapPin} sub="cards out" />
        <StatCard label="Patrols active" value={activePatrols} icon={Shield} />
        <StatCard label="Keys issued" value={issuedKeys} icon={KeyRound} />
        <StatCard label="Unacknowledged alerts" value={unackAlerts} icon={Bell} tone={unackAlerts ? "red" : "green"} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>Critical &amp; unresolved</span></div>
          {unresolvedAlerts.length === 0 ? (
            <div className="empty-state"><Bell size={26} strokeWidth={1.5} /><div className="empty-title">No unresolved alerts</div></div>
          ) : (
            <ul className="feed">
              {unresolvedAlerts.map((a) => (
                <li key={a.id}>
                  <Link href="/alerts" className="feed-row">
                    <span className={`feed-dot tone-${severityTone(a.severity)}`} />
                    <div className="feed-main">
                      <div className="feed-label">{a.message}</div>
                      <div className="feed-meta mono">{a.type} · {a.location ?? "—"}</div>
                    </div>
                    <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-head"><span>Activity feed</span></div>
          <ul className="feed">
            {recentIncidents.map((i) => (
              <li key={i.id}>
                <Link href="/incidents" className="feed-row">
                  <span className={`feed-dot tone-${severityTone(i.severity)}`} />
                  <div className="feed-main">
                    <div className="feed-label">{i.title}</div>
                    <div className="feed-meta mono">{i.category} · {fmtTime(i.created_at)}</div>
                  </div>
                </Link>
              </li>
            ))}
            {recentIncidents.length === 0 ? <li style={{ padding: 12, opacity: 0.6, fontSize: 13 }}>No activity yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
