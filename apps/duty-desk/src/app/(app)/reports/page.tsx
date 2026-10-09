import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { buildAnalytics, parsePeriod, PERIODS, type Ranked } from "@/lib/reports/analytics";
import { getReadiness, countByStatus } from "@/lib/data/readiness";
import { toBoardApt } from "@/lib/board";
import { lagosDayKey } from "@/lib/time";
import { Columns, DonutCard, DotMatrix, PrepBars, RingTile, STATUS_COLOR, StatusLegend, pct } from "@/components/infographic";
import { EmailReportButton } from "./email-report-button";

const BANDS = ["12a", "4a", "8a", "12p", "4p", "8p"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAT_COLORS = ["var(--cat1)", "var(--cat2)", "var(--cat3)", "var(--cat4)", "var(--cat5)"];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function RankList({ rows, empty }: { rows: Ranked[]; empty: string }) {
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  const max = rows[0].value;
  return (
    <ol className="rank">
      {rows.map((r, i) => (
        <li key={r.name}>
          <span className="n">{i + 1}</span>
          <div><b>{r.name}</b><small>{r.detail}</small><span className="tr"><span style={{ width: `${(r.value / max) * 100}%` }} /></span></div>
          <span className="v">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}

const StatusBars = ({ rows, total }: { rows: [string, number, string][]; total: number }) => (
  <div className="card-b">
    {rows.map(([l, n, tone]) => (
      <div key={l} className="hbar hb2"><span>{l}</span><span className="tr"><span style={{ width: `${pct(n, total)}%`, background: `var(--${tone})` }} /></span><span className="mono" style={{ textAlign: "right" }}>{n}</span></div>
    ))}
  </div>
);

export default async function ReportsPage({ searchParams }: { searchParams: { days?: string } }) {
  const session = await requirePageAccess("/reports");
  const days = parsePeriod(searchParams.days);
  const [a, readiness] = await Promise.all([buildAnalytics(days), getReadiness()]);

  const c = countByStatus(readiness), total = readiness.length, empty = total - c.occupied;
  const apts = readiness.map((r) => toBoardApt(r, session.staffId));
  const prepsReady = a.preps.reduce((s, p) => s + p.ready, 0), prepsAll = a.preps.reduce((s, p) => s + p.ready + p.not, 0);
  const firstTime = pct(prepsReady, prepsAll);
  const [cmp, tkt] = a.status;
  const cmpAll = cmp.open + cmp.progress + cmp.resolved, tktAll = tkt.open + tkt.progress + tkt.resolved;

  // Guests due to leave each of the next 7 days (anyone overdue counts as today).
  const next = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 86400000));
  const leaving = readiness.map((r) => r.stay?.until).filter(Boolean) as string[];
  const cols = next.map((d, i) => {
    const k = lagosDayKey(d.toISOString());
    const n = leaving.filter((u) => (i === 0 ? u <= k : u === k)).length;
    const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "Africa/Lagos" });
    return { label: i === 0 ? "Today" : label, v: n, title: `${i === 0 ? "Today" : label}: ${plural(n, "check-out")}` };
  });
  const later = leaving.filter((u) => u > lagosDayKey(next[6].toISOString())).length;
  const busiest = cols.reduce((x, y) => (y.v > x.v ? y : x), cols[0]);
  const noDate = readiness.filter((r) => r.stay && !r.stay.until).length;

  const catParts = a.categories.map((k, i) => ({ label: k.name, v: k.value, color: CAT_COLORS[i % CAT_COLORS.length] }));
  const srcTotal = a.sources.reduce((s, x) => s + x.value, 0);
  const dmax = Math.max(1, ...a.depts.map((d) => d.total));
  const omax = Math.max(1, ...a.officers.map((o) => o.value));
  const heatMax = Math.max(0, ...a.heat.flat());
  const heatLevel = (v: number) => (v === 0 || heatMax === 0 ? 0 : Math.min(4, Math.ceil((v / heatMax) * 4)));

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Reports</h1><p>How the apartments, complaints and repairs are going, at a glance. Tap any square for that apartment, or download a list as a spreadsheet file.</p></div>
        <div className="acts">
          <nav className="seg" aria-label="Period">
            {PERIODS.map((p) => <Link key={p} href={`/reports?days=${p}`} aria-pressed={p === days} aria-current={p === days ? "page" : undefined} scroll={false} className="seg-link">Last {p} days</Link>)}
          </nav>
        </div>
      </div>

      <div className="kpis k4 ig-kpis">
        <RingTile p={pct(c.ready, empty)} color="var(--ok)" big={`${c.ready} of ${empty} ready to sell`} line="Empty apartments front desk can sell now" />
        <RingTile p={pct(c.occupied, total)} color="var(--cat2)" big={`${c.occupied} of ${total} occupied`} line="Apartments with a guest checked in" />
        <RingTile p={firstTime} color="var(--acc)" big={prepsAll ? `${firstTime}% ready first time` : "No check-in preps yet"} line={`${plural(prepsAll, "check-in prep")} in the last ${days} days`} />
        <RingTile p={pct(tkt.resolved, tktAll)} color="var(--warn)" big={`${tkt.resolved} of ${tktAll} repairs done`} line={`${cmp.resolved} of ${cmpAll} complaints resolved · last ${days} days`} />
      </div>

      <div className="g g-ig">
        <section className="card">
          <div className="card-h"><h3>Every apartment at a glance</h3><span className="sp" /><span className="sub">{total} apartments · one square each</span></div>
          <DotMatrix apts={apts} />
          <div style={{ padding: "0 20px 16px" }}><StatusLegend counts={c} /></div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Apartment status</h3><span className="sp" /><Link href="/board" className="link">Open board <ArrowRight size={13} /></Link></div>
          <DonutCard
            parts={([["ready", "Ready to sell"], ["recheck", "Re-check due"], ["notready", "Not ready"], ["inspecting", "Inspecting"], ["unchecked", "Needs checklist"], ["occupied", "Occupied"]] as const).map(([k, l]) => ({ label: l, v: c[k], color: STATUS_COLOR[k], dashed: k === "unchecked" }))}
            centre={c.ready}
            sub="ready to sell"
          />
          <p className="ig-note">{c.notready + c.unchecked + c.recheck + c.inspecting} empty apartments can’t be sold yet: {c.notready} waiting on repairs, {c.unchecked + c.recheck} waiting for a check-in prep, {c.inspecting} being checked now.</p>
        </section>
      </div>

      <div className="g g-ig">
        <section className="card">
          <div className="card-h"><h3>Check-in preps submitted</h3><span className="sub">last {days} days</span><span className="sp" /><div className="legend"><span><i style={{ background: "var(--ok)" }} />Ready</span><span><i style={{ background: "var(--bad)" }} />Not ready</span></div></div>
          <div className="card-b"><PrepBars preps={a.preps} /></div>
          <p className="ig-note">{prepsAll ? `${firstTime}% of check-in preps found nothing wrong. The rest opened repair tickets before the apartment could be sold.` : "No check-in preps were submitted in this period."}</p>
        </section>
        <section className="card">
          <div className="card-h"><h3>Check-outs coming up</h3><span className="sp" /><span className="sub">next 7 days</span></div>
          <div className="card-b"><Columns cols={cols} /></div>
          <p className="ig-note">
            {leaving.length || noDate ? <>Every check-out means a check-in prep the same day.{busiest.v ? <> Busiest: <b>{busiest.label}</b> with {busiest.v}.</> : null}{later ? ` ${plural(later, "more guest")} leave later.` : ""}{noDate ? ` ${plural(noDate, "guest")} with no check-out date.` : ""}</> : "No guests are checked in yet. Check-outs show here once check-ins are recorded."}
          </p>
        </section>
      </div>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Complaints by type</h3><span className="sub">last {days} days</span><span className="sp" /><Link href="/complaints" className="link">Open complaints <ArrowRight size={13} /></Link></div>
          {catParts.length ? (
            <>
              <DonutCard parts={catParts} centre={cmpAll} sub="complaints" />
              <p className="ig-note">{cmp.open + cmp.progress} still open. Most common: <b>{catParts[0].label.toLowerCase()}</b>.</p>
            </>
          ) : <p className="ig-note" style={{ paddingTop: 16 }}>No complaints in this period.</p>}
        </section>
        <section className="card">
          <div className="card-h"><h3>Where repairs come from</h3><span className="sub">last {days} days</span><span className="sp" /><Link href="/maintenance" className="link">Open maintenance <ArrowRight size={13} /></Link></div>
          <div className="card-b vstack" style={{ gap: 14 }}>
            {srcTotal ? (
              <>
                <div className="stack100" role="img" aria-label={a.sources.map((s) => `${s.name} ${s.value}`).join(", ")}>
                  {a.sources.map((s, i) => <span key={s.name} style={{ flex: s.value, background: CAT_COLORS[i % CAT_COLORS.length] }} title={`${s.name}: ${s.value}`} />)}
                </div>
                <div className="legend">{a.sources.map((s, i) => <span key={s.name}><i style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />{s.name} {s.value} · {pct(s.value, srcTotal)}%</span>)}</div>
                <hr className="sep" />
                <span className="over">By department · open of total</span>
                {a.depts.map((d) => (
                  <div key={d.name} className="hbar">
                    <span>{d.name}</span>
                    <span className="tr" style={{ display: "flex" }}><span style={{ width: `${(d.open / dmax) * 100}%`, background: "var(--warn)" }} /><span style={{ width: `${((d.total - d.open) / dmax) * 100}%`, background: "var(--ok)" }} /></span>
                    <span className="mono" style={{ textAlign: "right" }}>{d.open} open · {d.total}</span>
                  </div>
                ))}
              </>
            ) : <p className="muted" style={{ margin: 0 }}>No repair tickets in this period.</p>}
          </div>
        </section>
      </div>

      <div className="g g-3">
        <section className="card">
          <div className="card-h"><h3>Who did the check-in preps</h3><span className="sp" /><span className="sub">last {days} days</span></div>
          <div className="card-b">
            {a.officers.length ? a.officers.map((o) => (
              <div key={o.name} className="hbar hb2"><span>{o.name}</span><span className="tr"><span style={{ width: `${(o.value / omax) * 100}%`, background: "var(--acc)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{o.value}</span></div>
            )) : <p className="muted" style={{ margin: 0 }}>No check-in preps in this period.</p>}
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Complaints</h3><span className="sp" /><span className="sub">by status</span></div>
          <StatusBars total={cmpAll} rows={[["Open", cmp.open, "warn"], ["In progress", cmp.progress, "info"], ["Resolved", cmp.resolved, "ok"]]} />
        </section>
        <section className="card">
          <div className="card-h"><h3>Repair tickets</h3><span className="sp" /><span className="sub">by status</span></div>
          <StatusBars total={tktAll} rows={[["Reported", tkt.open, "warn"], ["In progress", tkt.progress, "info"], ["Resolved", tkt.resolved, "ok"]]} />
        </section>
      </div>

      <div className="g g-3">
        <section className="card">
          <div className="card-h"><h3>Apartments &amp; areas with most issues</h3></div>
          <div className="card-b"><RankList rows={a.rooms} empty="No complaints or repairs in this period." /></div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Most flagged checklist items</h3></div>
          <div className="card-b"><RankList rows={a.flagged} empty="Nothing damaged or missing on checklists in this period." /></div>
        </section>
        <section className="card">
          <div className="card-h"><h3>When issues come in</h3><span className="sp" /><span className="sub">Lagos time</span></div>
          <div className="card-b">
            {heatMax ? (
              <>
                <div className="heat-grid" role="table" aria-label="Complaints and repair tickets by weekday and time of day">
                  <span />
                  {BANDS.map((b) => <span key={b} className="heat-x">{b}</span>)}
                  {WEEKDAYS.map((d, r) => (
                    <div key={d} style={{ display: "contents" }} role="row">
                      <span className="heat-y">{d}</span>
                      {a.heat[r].map((v, i) => <span key={i} className={`heat-cell h${heatLevel(v)}`} title={`${d} ${BANDS[i]}–${BANDS[(i + 1) % 6]}: ${plural(v, "item")}`} role="cell" aria-label={`${d} ${BANDS[i]}: ${v}`} />)}
                    </div>
                  ))}
                </div>
                <div className="heat-scale">Fewer {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`heat-cell h${l}`} />)} More</div>
              </>
            ) : <p className="muted" style={{ margin: 0 }}>Nothing logged in this period.</p>}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><h3>Download records</h3><span className="sp" /><span className="sub">CSV files open in Excel or Google Sheets</span></div>
        <div className="card-b">
          {([["checklists", "Checklists", "Every submitted checklist, with who did it and the result"], ["complaints", "Complaints", "Every complaint, with its status and team"], ["tickets", "Maintenance tickets", "Every repair ticket, with where it came from"]] as const).map(([k, l, sub]) => (
            <div key={k} className="dl-row">
              <div className="t"><b>{l}</b><span>{sub}</span></div>
              <a className="btn btn-secondary btn-sm" href={`/reports/export/${k}`}><Download size={14} /> Download CSV</a>
              <EmailReportButton dataset={k} label={l} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
