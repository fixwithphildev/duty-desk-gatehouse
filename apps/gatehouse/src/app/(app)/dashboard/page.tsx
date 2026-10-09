import Link from "next/link";
import { ArrowRight, Car, Clock, Package, Route, TriangleAlert } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { GH_CAN_EDIT, GH_SEVERITIES, SEV_COLOR, sevTone, type Severity } from "@/lib/types";
import { fmtDur, isOverdue, minsSince, pl } from "@/lib/gate";
import { clockTime, lagosDayKey, todayLong, whenText } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Kpi } from "@/components/suite";
import { RaiseAlert } from "@/components/raise-alert";

type Ev = { at: string; k: "IN" | "OUT" | "ITEM" | "BACK" | "PATROL" | "DONE" | "INCIDENT" | "ALERT"; tone: string; a: string; b: string; href: string; mono?: boolean };

export default async function CommandPage() {
  const session = await requireSession();
  const { out, recent, items, patrols, incidents, alerts, rackSize } = await getDesk();

  const over = out.filter((v) => isOverdue(v.entry_at));
  const openInc = incidents.filter((i) => !i.void && i.status !== "Resolved").sort((a, b) => GH_SEVERITIES.indexOf(b.severity) - GH_SEVERITIES.indexOf(a.severity) || b.created_at.localeCompare(a.created_at));
  const highInc = openInc.filter((i) => i.severity === "High" || i.severity === "Critical").length;
  const itemsOut = items.filter((i) => !i.void && i.status === "Out").sort((a, b) => a.out_at.localeCompare(b.out_at));
  const active = patrols.filter((p) => !p.void && p.status === "In Progress");

  // Gate activity: the latest entries, exits, items, patrols, incidents and alerts.
  const ev: Ev[] = [];
  for (const v of recent.filter((x) => !x.void)) {
    ev.push({ at: v.entry_at, k: "IN", tone: "warn", a: `Card ${v.card} · ${v.plate}`, b: `${v.driver ? v.driver + " · " : ""}logged by ${v.logged_by_name ?? "—"}`, href: `/gate?card=${v.card}`, mono: true });
    if (v.exit_at) ev.push({ at: v.exit_at, k: "OUT", tone: "ok", a: `Card ${v.card} · ${v.plate}`, b: `On property ${fmtDur(minsSince(v.entry_at, new Date(v.exit_at).getTime()))}${v.exit_by_name ? ` · ${v.exit_by_name}` : ""}`, href: "/gate", mono: true });
  }
  for (const i of items.filter((x) => !x.void).slice(0, 60)) {
    ev.push({ at: i.out_at, k: "ITEM", tone: "info", a: `${i.item} out`, b: `Carried by ${i.carried_by}${i.authorized_by ? ` · authorised by ${i.authorized_by}` : ""}`, href: `/items?id=${i.id}` });
    if (i.in_at) ev.push({ at: i.in_at, k: "BACK", tone: "ok", a: `${i.item} back in`, b: `Out ${fmtDur(minsSince(i.out_at, new Date(i.in_at).getTime()))}`, href: `/items?id=${i.id}` });
  }
  for (const p of patrols.filter((x) => !x.void).slice(0, 40)) {
    ev.push({ at: p.started_at, k: "PATROL", tone: "neu", a: `${p.route} started`, b: p.officer_name, href: "/patrols" });
    if (p.ended_at) ev.push({ at: p.ended_at, k: "DONE", tone: "ok", a: `${p.route} finished`, b: `${p.officer_name} · ${fmtDur(minsSince(p.started_at, new Date(p.ended_at).getTime()))}`, href: "/patrols" });
  }
  for (const i of incidents.filter((x) => !x.void).slice(0, 40)) ev.push({ at: i.created_at, k: "INCIDENT", tone: sevTone(i.severity), a: i.title, b: `${i.severity} · ${i.reported_by_name}${i.location ? ` · ${i.location}` : ""}`, href: `/incidents?id=${i.id}` });
  for (const a of alerts.filter((x) => !x.void).slice(0, 20)) ev.push({ at: a.created_at, k: "ALERT", tone: "bad", a: `${a.type}${a.location ? ` · ${a.location}` : ""}`, b: `Raised by ${a.raised_by_name} · ${a.severity}`, href: `/alerts?id=${a.id}` });
  ev.sort((a, b) => b.at.localeCompare(a.at));
  const feed = ev.slice(0, 10);
  const today = lagosDayKey(new Date().toISOString());

  // Incidents per day for 14 days, stacked by severity.
  const days = Array.from({ length: 14 }, (_, i) => lagosDayKey(new Date(Date.now() - (13 - i) * 86400_000).toISOString()));
  const sev14 = days.map((d) => GH_SEVERITIES.map((s) => incidents.filter((i) => !i.void && i.severity === s && lagosDayKey(i.created_at) === d).length));
  const mx = Math.max(2, ...sev14.map((r) => r.reduce((a, b) => a + b, 0)));
  const W = 560, H = 170, L = 24, B = 22, bw = (W - L) / 14;

  const buckets: [string, number][] = [
    ["Under 1h", out.filter((v) => minsSince(v.entry_at) < 60).length],
    ["1–4h", out.filter((v) => { const m = minsSince(v.entry_at); return m >= 60 && m < 240; }).length],
    ["4–12h", out.filter((v) => { const m = minsSince(v.entry_at); return m >= 240 && m < 720; }).length],
    ["Over 12h", over.length],
  ];

  return (
    <>
      <div className="phead">
        <div className="t">
          <span className="over">{todayLong()}</span>
          <h1>Security Command</h1>
          <p>{pl(out.length, "vehicle")} on property{over.length ? `, ${pl(over.length, "card")} overdue` : ""}. {active.length ? active.map((p) => `${p.officer_name} is on ${p.route}`).join("; ") + "." : "Nobody is on patrol right now."}</p>
        </div>
        <div className="acts">
          <AutoRefresh />
          <Link href="/gate" className="btn btn-secondary"><Car size={15} /> Gate Console</Link>
          {GH_CAN_EDIT.includes(session.role) ? <RaiseAlert /> : null}
        </div>
      </div>

      <div className="kpis">
        <Kpi icon={Car} label="Vehicles on property" value={out.length} unit={`/ ${rackSize} cards`} ctx={`${pl(Math.max(0, rackSize - out.length), "card")} free`} />
        <Kpi icon={Clock} label="Overdue cards" value={over.length} ctx="out longer than 12 hours" tile={over.length ? "bad" : ""} />
        <Kpi icon={TriangleAlert} label="Open incidents" value={openInc.length} ctx={openInc.length ? `${highInc} high or critical · ${openInc.length - highInc} others` : "none open"} tile={highInc ? "warn" : ""} />
        <Kpi icon={Package} label="Items out" value={itemsOut.length} ctx={itemsOut[0] ? `oldest ${fmtDur(minsSince(itemsOut[0].out_at))} · ${itemsOut[0].item}` : "everything is back"} />
        <Kpi icon={Route} label="Patrols" value={active.length} unit="active" ctx={active[0] ? `${active[0].route} · ${fmtDur(minsSince(active[0].started_at))} in` : "nobody on patrol"} />
      </div>

      <div className="g g-main">
        <section className="card feed">
          <div className="card-h"><h3>Gate activity</h3><span className="badge t-ok"><span className="d" />Live</span><span className="sp" /><span className="sub">latest events</span></div>
          <ul className="list">
            {feed.map((e, i) => (
              <li key={i}>
                <Link href={e.href} className="row click" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="mono age" style={{ width: 46 }}>{lagosDayKey(e.at) === today ? clockTime(e.at) : whenText(e.at).replace(/, \d\d:\d\d$/, "")}</span>
                  <span className={`ev t-${e.tone}`}>{e.k}</span>
                  <div className="m"><b className={e.mono ? "mono" : ""} style={{ fontSize: 13 }}>{e.a}</b><span>{e.b}</span></div>
                </Link>
              </li>
            ))}
            {feed.length === 0 ? <li className="empty">Nothing logged yet. Entries, exits, items, patrols and incidents show here as they happen.</li> : null}
          </ul>
        </section>
        <div className="vstack" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-h"><h3>Patrols</h3><span className="sp" />{active.length ? <Badge tone="info">{pl(active.length, "in progress", "in progress")}</Badge> : null}</div>
            <ul className="list">
              {active.map((p) => (
                <li key={p.id}><Link href="/patrols" className="row click" style={{ textDecoration: "none", color: "inherit" }}><span className="stripe s-info" /><div className="m"><b>{p.route}</b><span>{p.officer_name} · started {clockTime(p.started_at)} · {fmtDur(minsSince(p.started_at))} so far</span></div></Link></li>
              ))}
              {active.length === 0 ? <li className="empty" style={{ padding: 20 }}>Nobody is on patrol. <Link className="link" href="/patrols">Start one</Link></li> : null}
            </ul>
          </section>
          <section className="card">
            <div className="card-h"><h3>Open incidents</h3><span className="sp" /><Link href="/incidents" className="link">All incidents <ArrowRight size={13} /></Link></div>
            <ul className="list">
              {openInc.slice(0, 6).map((i) => (
                <li key={i.id}>
                  <Link href={`/incidents?id=${i.id}`} className="row click" style={{ textDecoration: "none", color: "inherit" }}>
                    <span className={`stripe s-${sevTone(i.severity)}`} />
                    <div className="m"><b>{i.title}</b><span className="mono">{i.ref} · {i.location ?? "no location"} · {whenText(i.created_at)}</span></div>
                    <Badge tone={sevTone(i.severity)} dot={false}>{i.severity}</Badge>
                  </Link>
                </li>
              ))}
              {openInc.length === 0 ? <li className="empty" style={{ padding: 20 }}>No open incidents.</li> : null}
            </ul>
          </section>
        </div>
      </div>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Incidents · last 14 days</h3><span className="sp" /><div className="legend">{GH_SEVERITIES.map((s) => <span key={s}><i style={{ background: SEV_COLOR[s] }} />{s}</span>)}</div></div>
          <div className="card-b">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Incidents per day by severity, last 14 days">
              {[0, Math.round(mx / 2), mx].map((v) => { const y = H - B - (v / mx) * (H - B - 10); return <g key={v}><line className="chart-grid" x1={L} x2={W} y1={y} y2={y} /><text className="chart-axis" x={L - 8} y={y + 3} textAnchor="end">{v}</text></g>; })}
              {sev14.map((d, i) => {
                let y = H - B; const x = L + i * bw + 6, w = bw - 12;
                return (
                  <g key={days[i]}>
                    <title>{`${days[i]}: ${d.map((n, k) => `${n} ${GH_SEVERITIES[k].toLowerCase()}`).join(", ")}`}</title>
                    {d.map((n, k) => { if (!n) return null; const h = (n / mx) * (H - B - 10); y -= h; return <rect key={k} x={x} y={y} width={w} height={Math.max(0, h - 1.5)} rx={2} fill={SEV_COLOR[GH_SEVERITIES[k] as Severity]} />; })}
                    <text className="chart-axis" x={x + w / 2} y={H - 6} textAnchor="middle">{Number(days[i].slice(8))}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Cards out by time on property</h3><span className="sp" /><Link href="/gate" className="link">Open rack <ArrowRight size={13} /></Link></div>
          <div className="card-b">
            {buckets.map(([l, n], k) => (
              <div key={l} className="hbar"><span>{l}</span><span className="tr"><span style={{ width: `${out.length ? (n / out.length) * 100 : 0}%`, background: k === 3 ? "var(--bad)" : "var(--acc)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{pl(n, "card")}</span></div>
            ))}
            <p className="hint" style={{ margin: "10px 0 0" }}>Over 12 hours usually means a lost card or a car left overnight. Check with the driver before marking anything.</p>
          </div>
        </section>
      </div>
    </>
  );
}
