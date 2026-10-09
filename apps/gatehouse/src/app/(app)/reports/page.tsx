import { Car, Download, Footprints, OctagonAlert, TriangleAlert } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { getVehicleLogsSince } from "@/lib/data/vehicles";
import { REPORT_DATASETS, REPORT_DATASET_LABELS } from "@/lib/reports/exports";
import { GH_SEVERITIES, SEV_COLOR } from "@/lib/types";
import { GH_ALERT_TYPES } from "@/lib/constants";
import { lagosDayKey } from "@/lib/time";
import { pl } from "@/lib/gate";
import { Kpi } from "@/components/suite";
import { Columns, DonutCard } from "@/components/infographic";
import { EmailReportButton } from "./email-report-button";

const DAY = 86400_000;

export default async function ReportsPage() {
  await requireSession();
  const { incidents, alerts, patrols, items } = await getDesk();
  const now = Date.now();
  const vehicles14 = (await getVehicleLogsSince(new Date(now - 14 * DAY).toISOString(), 20000)).filter((v) => !v.void);

  const inc = incidents.filter((i) => !i.void);
  const inc30 = inc.filter((i) => now - new Date(i.created_at).getTime() < 30 * DAY);
  const alerts30 = alerts.filter((a) => !a.void && now - new Date(a.created_at).getTime() < 30 * DAY);
  const patrols7 = patrols.filter((p) => !p.void && p.status === "Completed" && now - new Date(p.started_at).getTime() < 7 * DAY);
  const veh7 = vehicles14.filter((v) => now - new Date(v.entry_at).getTime() < 7 * DAY);

  // Vehicles in per day, last 7 days.
  const days = Array.from({ length: 7 }, (_, i) => lagosDayKey(new Date(now - (6 - i) * DAY).toISOString()));
  const perDay = days.map((d) => ({ d, n: vehicles14.filter((v) => lagosDayKey(v.entry_at) === d).length }));
  const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

  const count = <T,>(list: T[], key: (x: T) => string) => {
    const m = new Map<string, number>();
    for (const x of list) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byCat = count(inc30, (i) => i.category);
  const byPlace = count(inc30, (i) => i.location ?? "No location").slice(0, 6);
  const byType = GH_ALERT_TYPES.map((t) => [t, alerts30.filter((a) => a.type === t).length] as [string, number]);
  const catMax = Math.max(1, ...byCat.map(([, n]) => n)), typeMax = Math.max(1, ...byType.map(([, n]) => n));
  const records: Record<string, number> = { vehicles: vehicles14.length, items: items.length, incidents: incidents.length, patrols: patrols.length, alerts: alerts.length };

  return (
    <>
      <div className="phead"><div className="t"><h1>Reports</h1><p>What happened at the gate this week and this month. Download any record as a spreadsheet, or email it.</p></div></div>

      <div className="kpis k4">
        <Kpi icon={Car} label="Vehicles in this week" value={veh7.length} ctx={`${pl(new Set(veh7.map((v) => v.plate)).size, "different plate")}`} />
        <Kpi icon={TriangleAlert} label="Incidents, last 30 days" value={inc30.length} ctx={`${inc30.filter((i) => i.severity === "High" || i.severity === "Critical").length} high or critical`} />
        <Kpi icon={OctagonAlert} label="Alerts, last 30 days" value={alerts30.length} ctx={`${alerts30.filter((a) => a.severity === "Critical").length} critical`} tile={alerts30.length ? "warn" : ""} />
        <Kpi icon={Footprints} label="Patrols finished this week" value={patrols7.length} ctx={`${pl(new Set(patrols7.map((p) => p.officer_name)).size, "officer")}`} />
      </div>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Vehicles in, last 7 days</h3><span className="sp" /><span className="sub">entries logged at the gate</span></div>
          <div className="card-b"><Columns cols={perDay.map(({ d, n }) => ({ label: dayLabel(d), v: n, title: `${d}: ${n} vehicles` }))} /></div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Incidents by severity</h3><span className="sp" /><span className="sub">last 30 days</span></div>
          <DonutCard parts={GH_SEVERITIES.map((s) => ({ label: s, v: inc30.filter((i) => i.severity === s).length, color: SEV_COLOR[s] }))} centre={inc30.length} sub="incidents" />
        </section>
      </div>

      <div className="g g-3">
        <section className="card">
          <div className="card-h"><h3>Incidents by category</h3><span className="sp" /><span className="sub">last 30 days</span></div>
          <div className="card-b">
            {byCat.map(([c, n]) => <div key={c} className="hbar"><span>{c}</span><span className="tr"><span style={{ width: `${(n / catMax) * 100}%`, background: "var(--acc)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{n}</span></div>)}
            {byCat.length === 0 ? <p className="muted" style={{ margin: 0 }}>No incidents in the last 30 days.</p> : null}
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Where incidents happen</h3><span className="sp" /><span className="sub">top places</span></div>
          <div className="tbl-wrap">
            <table className="tbl"><thead><tr><th>Place</th><th className="r">Incidents</th></tr></thead>
              <tbody>
                {byPlace.map(([p, n]) => <tr key={p}><td style={{ whiteSpace: "normal" }}>{p}</td><td className="mono r">{n}</td></tr>)}
                {byPlace.length === 0 ? <tr><td colSpan={2} className="empty">Nothing yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Alerts by type</h3><span className="sp" /><span className="sub">last 30 days</span></div>
          <div className="card-b">
            {byType.map(([t, n]) => <div key={t} className="hbar"><span>{t}</span><span className="tr"><span style={{ width: `${(n / typeMax) * 100}%`, background: "var(--bad)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{n}</span></div>)}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><h3>Download records</h3><span className="sp" /><span className="sub">every record, as a CSV that opens in Excel or Google Sheets</span></div>
        <ul className="list">
          {REPORT_DATASETS.map((d) => (
            <li key={d} className="row">
              <div className="m"><b>{REPORT_DATASET_LABELS[d]}</b><span>{d === "vehicles" ? "Every entry and exit" : `${records[d]} record${records[d] === 1 ? "" : "s"}`}, including voided ones (marked)</span></div>
              <a className="btn btn-secondary btn-sm" href={`/reports/export/${d}`}><Download size={14} /> CSV</a>
              <EmailReportButton dataset={d} label={REPORT_DATASET_LABELS[d]} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
