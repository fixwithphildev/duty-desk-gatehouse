import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, Download, Plus, Receipt, Wallet } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { MD_MANAGE_ROLES, MD_UNITS, UNIT_COLOR, formatNaira as naira } from "@/lib/types";
import { getDesk } from "@/lib/data/desk";
import { getSpends, last12Months, monthName, ASKERS } from "@/lib/reports/spending";
import { lagosToday, shortDate, thisMonth, thisWeek, weekDays } from "@/lib/periods";
import { missingCost } from "@/lib/jobs";
import { Kpi } from "@/components/suite";
import { DonutCard, pct } from "@/components/infographic";
import { UnitIcon } from "@/components/unit-icon";

const ASKER_COLOR = ["var(--cat1)", "var(--cat3)", "var(--cat4)", "var(--cat5)"];
const niceMax = (v: number) => { if (v <= 0) return 300000; const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1.5 ? 1.5 : m <= 3 ? 3 : m <= 6 ? 6 : 12) * p; };
const short = (v: number) => (!v ? "0" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : Math.round(v / 1000) + "k");

export default async function SpendingPage() {
  const session = await requirePageAccess("/spending");
  const [spends, { jobs }] = await Promise.all([getSpends(), getDesk()]);
  const today = lagosToday(), mo = thisMonth(today), wk = thisWeek(today), months = last12Months(today);
  const total = (list: typeof spends) => list.reduce((a, s) => a + s.line.line_total, 0);

  const inMonth = spends.filter((s) => s.line.purchased_on >= mo.from && s.line.purchased_on <= mo.to);
  const tot = total(inMonth);
  const byMonth = months.map((m) => MD_UNITS.map((u) => total(spends.filter((s) => s.unit === u && s.line.purchased_on.startsWith(m)))));
  const monthTot = byMonth.map((r) => r.reduce((a, b) => a + b, 0));
  const lastMonth = monthTot[10];
  const jobsMo = new Set(inMonth.filter((s) => s.job).map((s) => s.job!.id)).size;
  const miss = jobs.filter(missingCost).length;

  const units = MD_UNITS.map((u) => {
    const ps = inMonth.filter((s) => s.unit === u), items = new Map<string, number>();
    for (const s of ps) items.set(s.line.item, (items.get(s.line.item) ?? 0) + s.line.line_total);
    return { u, n: ps.length, v: total(ps), jobs: total(ps.filter((s) => s.job)), stock: total(ps.filter((s) => !s.job)), tickets: new Set(ps.filter((s) => s.job).map((s) => s.job!.id)).size, top: [...items.entries()].sort((a, b) => b[1] - a[1])[0] };
  });
  const lead = [...units].sort((a, b) => b.v - a.v)[0];

  // Spent per month, stacked by unit
  const W = 640, H = 230, L = 50, B = 24, mx = niceMax(Math.max(...monthTot)), bw = (W - L) / 12;
  // This week, day by day
  const days = weekDays(wk.from);
  const dayV = days.map((d) => MD_UNITS.map((u) => total(spends.filter((s) => s.unit === u && s.line.purchased_on === d))));
  const dmx = Math.max(1, ...dayV.map((r) => r.reduce((a, b) => a + b, 0))), DW = 420, DH = 190, dbw = DW / 7;

  const who = ASKERS.map((k) => ({ k, v: total(inMonth.filter((s) => s.asker === k)) }));
  const whoTot = who.reduce((a, x) => a + x.v, 0);
  const agg = (key: (s: (typeof spends)[number]) => string, lines: boolean) => {
    const m = new Map<string, { v: number; ids: Set<string>; n: number; unit: string }>();
    for (const s of inMonth.filter((x) => x.job)) {
      const k = key(s), e = m.get(k) ?? { v: 0, ids: new Set<string>(), n: 0, unit: s.unit };
      e.v += s.line.line_total; e.ids.add(s.job!.id); e.n += 1; m.set(k, e);
    }
    return [...m.entries()].map(([k, e]) => ({ k, v: e.v, c: lines ? e.n : e.ids.size, unit: e.unit })).sort((a, b) => b.v - a.v).slice(0, 6);
  };
  const areas = agg((s) => s.job!.area, false), items = agg((s) => s.line.item, true);
  const amax = Math.max(1, ...areas.map((x) => x.v)), imax = Math.max(1, ...items.map((x) => x.v));

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Spending</h1><p>What each maintenance unit bought, in Naira, counted by the date it was bought. Purchases are recorded on the Costs page.</p></div>
        <div className="acts">{MD_MANAGE_ROLES.includes(session.role) ? <Link className="btn btn-primary" href="/costs"><Plus size={15} /> Record a purchase</Link> : null}</div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Wallet} label={`Spent in ${mo.name}`} value={naira(tot)} ctx={`${monthName(months[10], "long")} ${naira(lastMonth)}`} data={monthTot.slice(-7)} />
        {tot ? <Kpi icon={BarChart3} label={`Top unit · ${lead.u}`} value={naira(lead.v)} ctx={`${pct(lead.v, tot)}% of everything bought in ${mo.name}`} /> : <Kpi icon={BarChart3} label="Top unit" value="—" ctx={`nothing bought yet in ${mo.name}`} />}
        <Kpi icon={Receipt} label="Jobs with purchases" value={jobsMo} ctx={`${inMonth.length} items bought · avg ${naira(total(inMonth.filter((s) => s.job)) / Math.max(1, jobsMo))} per job`} />
        <Kpi icon={AlertTriangle} label="Resolved, cost not recorded" value={miss} ctx="see Costs" tile={miss ? "bad" : ""} />
      </div>

      <div className="vstack" style={{ gap: 10 }}>
        <div className="hstack" style={{ justifyContent: "space-between" }}><h2 className="sec-t">{mo.name} by unit</h2><span className="hint">Each unit’s share of {naira(tot)}</span></div>
        <div className="u-grid">
          {units.map((x) => (
            <div key={x.u} className="card u-big" style={{ ["--uc" as string]: UNIT_COLOR[x.u] }}>
              <div className="hstack" style={{ gap: 10, flexWrap: "nowrap" }}><span className="u-ic"><UnitIcon unit={x.u} size={17} /></span><b style={{ fontSize: 14 }}>{x.u}</b></div>
              <div className="u-amt mono">{naira(x.v)}</div>
              <span className="u-share"><span style={{ width: `${pct(x.v, tot)}%` }} /></span>
              <span className="u-sub"><b>{pct(x.v, tot)}%</b> of {mo.name} · {x.n} item{x.n === 1 ? "" : "s"} · {x.tickets} job{x.tickets === 1 ? "" : "s"}</span>
              <span className="u-sub">Jobs {naira(x.jobs)} · stock {naira(x.stock)}</span>
              <span className="u-top">{x.top ? <>Biggest buy: <b>{x.top[0]}</b> · {naira(x.top[1])}</> : "Nothing bought yet this month"}</span>
              <Link className="link" href={`/costs?unit=${encodeURIComponent(x.u)}`}>See {x.u} costs <ArrowRight size={13} /></Link>
            </div>
          ))}
        </div>
      </div>

      <div className="g g-ig">
        <section className="card">
          <div className="card-h"><h3>Spent per month, by unit</h3><span className="sp" /><div className="legend">{MD_UNITS.map((u) => <span key={u}><i style={{ background: UNIT_COLOR[u] }} />{u}</span>)}</div></div>
          <div className="card-b">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Maintenance spending per month by unit, last 12 months">
              {[0, mx / 3, (mx * 2) / 3, mx].map((v) => { const y = H - B - (v / mx) * (H - B - 12); return <g key={v}><line className="chart-grid" x1={L} x2={W} y1={y} y2={y} /><text className="chart-axis" x={L - 8} y={y + 3} textAnchor="end">{short(v)}</text></g>; })}
              {monthTot.map((v, i) => {
                let y = H - B; const x0 = L + i * bw + 7, w = bw - 14;
                return (
                  <g key={months[i]}>
                    <title>{`${monthName(months[i], "long")}${i === 11 ? " (to date)" : ""}: ${naira(v)}`}</title>
                    {byMonth[i].map((part, k) => { const h = (part / mx) * (H - B - 12); y -= h; return h > 0.5 ? <rect key={k} x={x0} y={y} width={w} height={Math.max(0, h - 1)} fill={UNIT_COLOR[MD_UNITS[k]]} /> : null; })}
                    <text className="chart-axis" x={x0 + w / 2} y={H - 6} textAnchor="middle">{monthName(months[i])}</text>
                  </g>
                );
              })}
            </svg>
            <p className="hint" style={{ margin: "8px 0 0" }}>Added up from the purchases recorded on Costs. {mo.name} is month to date.</p>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Share of {mo.name}</h3></div>
          <DonutCard parts={units.map((x) => ({ label: x.u, v: x.v, color: UNIT_COLOR[x.u] }))} centre={tot >= 1000 ? `${Math.round(tot / 1000)}k` : Math.round(tot)} sub="naira spent" fmt={naira} />
          <p className="ig-note">{tot ? <><b>{lead.u}</b> spent the most this month: {pct(lead.v, tot)}% of everything bought.</> : "Nothing bought yet this month. Purchases recorded on Costs show up here."}</p>
        </section>
      </div>

      <div className="g g-ig">
        <section className="card">
          <div className="card-h"><h3>This week, day by day</h3><span className="sp" /><span className="sub">{shortDate(wk.from)} – {shortDate(wk.to)}</span></div>
          <div className="card-b">
            <svg viewBox={`0 0 ${DW} ${DH}`} width="100%" role="img" aria-label="Spending each day this week by unit">
              {dayV.map((r, i) => {
                let y = DH - 26; const x0 = i * dbw + dbw * 0.2, w = dbw * 0.6, s = r.reduce((a, b) => a + b, 0);
                const label = new Date(days[i] + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
                return (
                  <g key={days[i]}>
                    <title>{`${label} ${shortDate(days[i])}: ${naira(s)}`}</title>
                    {r.map((v, k) => { const h = (v / dmx) * (DH - 56); y -= h; return h > 0.5 ? <rect key={k} x={x0} y={y} width={w} height={Math.max(0, h - 1)} fill={UNIT_COLOR[MD_UNITS[k]]} /> : null; })}
                    {s ? <text x={x0 + w / 2} y={y - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-2)">{short(s)}</text> : null}
                    <text className="chart-axis" x={x0 + w / 2} y={DH - 8} textAnchor="middle" fontWeight={days[i] === today ? 700 : 400}>{label}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Who the money was spent for</h3><span className="sp" /><span className="sub">{mo.name}</span></div>
          <div className="card-b vstack" style={{ gap: 14 }}>
            {whoTot ? (
              <>
                <div className="stack100" role="img" aria-label={who.map((x) => `${x.k} ${naira(x.v)}`).join(", ")}>{who.map((x, i) => x.v ? <span key={x.k} style={{ flex: x.v, background: ASKER_COLOR[i] }} title={`${x.k}: ${naira(x.v)}`} /> : null)}</div>
                <div className="legend">{who.map((x, i) => <span key={x.k}><i style={{ background: ASKER_COLOR[i] }} />{x.k} {naira(x.v)} · {pct(x.v, whoTot)}%</span>)}</div>
              </>
            ) : <p className="muted" style={{ margin: 0 }}>Nothing bought yet this month.</p>}
          </div>
        </section>
      </div>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Where the money went</h3><span className="sp" /><span className="sub">top areas · {mo.name}</span></div>
          <div className="card-b">{areas.length ? areas.map((x) => <div key={x.k} className="hbar"><span>{x.k}</span><span className="tr"><span style={{ width: `${(x.v / amax) * 100}%`, background: UNIT_COLOR[x.unit] ?? "var(--acc)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{naira(x.v)}</span></div>) : <p className="muted" style={{ margin: 0 }}>Nothing bought for jobs yet this month.</p>}</div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Most bought</h3><span className="sp" /><span className="sub">by amount · {mo.name}</span></div>
          <div className="card-b">{items.length ? items.map((x) => <div key={x.k} className="hbar"><span>{x.k}</span><span className="tr"><span style={{ width: `${(x.v / imax) * 100}%`, background: UNIT_COLOR[x.unit] ?? "var(--acc)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{naira(x.v)}</span></div>) : <p className="muted" style={{ margin: 0 }}>Nothing bought for jobs yet this month.</p>}</div>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><h3>Download</h3><span className="sp" /><span className="sub">CSV files open in Excel or Google Sheets</span></div>
        <form className="card-b hstack" style={{ gap: 12, alignItems: "flex-end" }} action="/spending/export" method="get">
          <div className="field" style={{ width: 170 }}><label htmlFor="sp-from">From</label><input className="input mono" id="sp-from" name="from" type="date" defaultValue={`${today.slice(0, 4)}-01-01`} max={today} /></div>
          <div className="field" style={{ width: 170 }}><label htmlFor="sp-to">To</label><input className="input mono" id="sp-to" name="to" type="date" defaultValue={today} max={today} /></div>
          <button className="btn btn-secondary" type="submit" name="kind" value="purchases"><Download size={15} /> Every purchase</button>
          <button className="btn btn-secondary" type="submit" name="kind" value="units"><Download size={15} /> Units by month</button>
        </form>
      </section>
    </>
  );
}
