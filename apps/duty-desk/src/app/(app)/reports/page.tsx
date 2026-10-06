import Link from "next/link";
import { ClipboardCheck, Download, MessageSquareWarning, Wrench } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { buildAnalytics, parsePeriod, PERIODS, SERIES_KEYS, type Ranked, type SeriesKey } from "@/lib/reports/analytics";
import { ActivityChart } from "@/components/activity-chart";
import { EmailReportButton } from "./email-report-button";

const COLORS: Record<SeriesKey, string> = { Complaints: "var(--s1)", Maintenance: "var(--s2)", Checklists: "var(--s3)" };
const BANDS = ["12a", "4a", "8a", "12p", "4p", "8p"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 92, h = 36;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Change vs the previous period. More complaints or maintenance is bad
// (red); more checklists done is good (teal).
function Delta({ now, before, goodWhenUp, days }: { now: number; before: number; goodWhenUp: boolean; days: number }) {
  if (before === 0 && now === 0) return <div className="kpi-note">No activity in either period</div>;
  if (before === 0) return <div className="kpi-note">New this period · none in the {days} days before</div>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct > 0;
  const tone = pct === 0 ? "flat" : up === goodWhenUp ? "good" : "bad";
  return (
    <div className="kpi-note">
      <span className={`kpi-delta ${tone}`}>{pct === 0 ? "—" : up ? "▲" : "▼"} {Math.abs(pct)}%</span>
      vs previous {days} days
    </div>
  );
}

function RankList({ rows, empty }: { rows: Ranked[]; empty: string }) {
  if (rows.length === 0) return <p className="analytics-empty">{empty}</p>;
  const max = rows[0].value;
  return (
    <ol className="rank-list">
      {rows.map((r, i) => (
        <li key={r.name} className="rank-row">
          <span className="rank-n">{i + 1}</span>
          <div className="rank-main">
            <div className="rank-name">{r.name}</div>
            <div className="rank-detail">{r.detail}</div>
            <div className="rank-bar"><span style={{ width: `${(r.value / max) * 100}%` }} /></div>
          </div>
          <span className="rank-value">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: { days?: string } }) {
  await requirePageAccess("/reports");
  const days = parsePeriod(searchParams.days);
  const a = await buildAnalytics(days);

  const readyPct = a.ready.checked ? Math.round((a.ready.ready / a.ready.checked) * 100) : 0;
  const statusTotals = a.status.reduce((acc, s) => ({ resolved: acc.resolved + s.resolved, all: acc.all + s.open + s.progress + s.resolved }), { resolved: 0, all: 0 });
  const heatMax = Math.max(0, ...a.heat.flat());
  const heatLevel = (v: number) => (v === 0 || heatMax === 0 ? 0 : Math.min(4, Math.ceil((v / heatMax) * 4)));
  const catMax = Math.max(1, ...a.categories.map((c) => c.value));

  return (
    <div className="view analytics">
      <div className="dash-hero">
        <div>
          <div className="eyebrow">Reports &amp; Analytics</div>
          <h1>How the property is running</h1>
          <p className="dash-hero-sub">Last {days} days compared with the {days} days before.</p>
        </div>
        <nav className="period-seg" aria-label="Period">
          {PERIODS.map((p) => (
            <Link key={p} href={`/reports?days=${p}`} className={p === days ? "on" : ""} aria-current={p === days ? "page" : undefined} scroll={false}>{p} days</Link>
          ))}
        </nav>
      </div>

      <section className="kpi-grid">
        {SERIES_KEYS.map((k) => (
          <div key={k} className="kpi-tile">
            <div className="kpi-top"><span>{k} logged</span><span className="kpi-chip">{days}d</span></div>
            <div className="kpi-row">
              <span className="kpi-value">{a.totals[k]}</span>
              <Sparkline values={a.series[k]} color={COLORS[k]} />
            </div>
            <Delta now={a.totals[k]} before={a.previous[k]} goodWhenUp={k === "Checklists"} days={days} />
          </div>
        ))}
        <div className="kpi-tile">
          <div className="kpi-top"><span>Apartments ready</span><span className="kpi-chip">now</span></div>
          {a.ready.checked ? (
            <>
              <div className="kpi-row"><span className="kpi-value">{readyPct}<small>%</small></span></div>
              <div className="kpi-meter" role="img" aria-label={`${a.ready.ready} of ${a.ready.checked} apartments ready`}><span style={{ width: `${readyPct}%` }} /></div>
              <div className="kpi-note">{a.ready.ready} of {a.ready.checked} checked apartments</div>
            </>
          ) : (
            <p className="analytics-empty" style={{ marginTop: 16 }}>No checklists submitted yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div><span>Activity over time</span><div className="card-sub">Items logged per day</div></div>
        </div>
        <ActivityChart dates={a.dates} series={SERIES_KEYS.map((k) => ({ key: k, color: COLORS[k], values: a.series[k] }))} />
      </section>

      <div className="analytics-grid3">
        <section className="card">
          <div className="card-head" style={{ marginBottom: 4 }}><div><span>Complaints by category</span><div className="card-sub">Where guest issues come from</div></div></div>
          {a.categories.length ? (
            <div className="hbar-list">
              {a.categories.map((c) => (
                <div key={c.name} className="hbar-row" title={`${c.name}: ${c.value}`}>
                  <span className="hbar-name">{c.name}</span>
                  <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(c.value / catMax) * 100}%` }} /></span>
                  <span className="hbar-value">{c.value}</span>
                </div>
              ))}
            </div>
          ) : <p className="analytics-empty">No complaints in this period.</p>}
        </section>

        <section className="card">
          <div className="card-head" style={{ marginBottom: 4 }}><div><span>Open vs resolved</span><div className="card-sub">Status of items logged in this period</div></div></div>
          {statusTotals.all ? (
            <>
              <div className="status-headline">
                <span className="kpi-value">{Math.round((statusTotals.resolved / statusTotals.all) * 100)}<small>%</small></span>
                <span className="kpi-note" style={{ margin: 0 }}>resolved overall · {statusTotals.resolved} of {statusTotals.all}</span>
              </div>
              {a.status.map((s) => {
                const t = s.open + s.progress + s.resolved;
                if (!t) return <div key={s.name} className="status-row"><div className="status-label">{s.name}<span>none logged</span></div></div>;
                return (
                  <div key={s.name} className="status-row">
                    <div className="status-label">{s.name}<span>{s.resolved} of {t} resolved · {Math.round((s.resolved / t) * 100)}%</span></div>
                    <div className="status-stack" role="img" aria-label={`${s.name}: ${s.open} open, ${s.progress} in progress, ${s.resolved} resolved`}>
                      {s.open ? <span style={{ flexGrow: s.open, background: "var(--st-open)" }} title={`Open: ${s.open}`} /> : null}
                      {s.progress ? <span style={{ flexGrow: s.progress, background: "var(--st-prog)" }} title={`In progress: ${s.progress}`} /> : null}
                      {s.resolved ? <span style={{ flexGrow: s.resolved, background: "var(--st-done)" }} title={`Resolved: ${s.resolved}`} /> : null}
                    </div>
                  </div>
                );
              })}
              <div className="status-legend"><span><i style={{ background: "var(--st-open)" }} />Open / Reported</span><span><i style={{ background: "var(--st-prog)" }} />In progress</span><span><i style={{ background: "var(--st-done)" }} />Resolved</span></div>
            </>
          ) : <p className="analytics-empty">Nothing logged in this period.</p>}
        </section>

        <section className="card">
          <div className="card-head" style={{ marginBottom: 4 }}><div><span>When issues come in</span><div className="card-sub">Complaints + maintenance by day and time</div></div></div>
          {heatMax ? (
            <>
              <div className="heat-grid" role="table" aria-label="Items logged by weekday and time of day">
                <span />
                {BANDS.map((b) => <span key={b} className="heat-x">{b}</span>)}
                {WEEKDAYS.map((d, r) => (
                  <div key={d} style={{ display: "contents" }} role="row">
                    <span className="heat-y">{d}</span>
                    {a.heat[r].map((v, c) => (
                      <span key={c} className={`heat-cell heat-${heatLevel(v)}`} title={`${d} ${BANDS[c]}–${BANDS[(c + 1) % 6]}: ${v} item${v === 1 ? "" : "s"}`} aria-label={`${d} ${BANDS[c]}: ${v}`} role="cell" />
                    ))}
                  </div>
                ))}
              </div>
              <div className="heat-scale">Fewer <i className="heat-0" /><i className="heat-1" /><i className="heat-2" /><i className="heat-3" /><i className="heat-4" /> More</div>
            </>
          ) : <p className="analytics-empty">Nothing logged in this period.</p>}
        </section>
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head" style={{ marginBottom: 4 }}><div><span>Rooms &amp; areas with most issues</span><div className="card-sub">Complaints and maintenance combined</div></div></div>
          <RankList rows={a.rooms} empty="No complaints or maintenance in this period." />
        </section>
        <section className="card">
          <div className="card-head" style={{ marginBottom: 4 }}><div><span>Most flagged checklist items</span><div className="card-sub">Marked Damaged or Missing on inspection</div></div></div>
          <RankList rows={a.flagged} empty="No damaged or missing items on checklists in this period." />
        </section>
      </div>

      <section className="card">
        <div className="card-head" style={{ marginBottom: 4 }}><div><span>Download records</span><div className="card-sub">Full record exports — CSV opens in Excel or Google Sheets; Email sends a copy as an attachment.</div></div></div>
        <div className="download-list">
          <div className="download-row">
            <a className="btn" href="/reports/export/checklists"><Download size={15} /> <ClipboardCheck size={15} /> Checklists</a>
            <EmailReportButton dataset="checklists" label="Checklists" />
          </div>
          <div className="download-row">
            <a className="btn" href="/reports/export/complaints"><Download size={15} /> <MessageSquareWarning size={15} /> Complaints</a>
            <EmailReportButton dataset="complaints" label="Complaints" />
          </div>
          <div className="download-row">
            <a className="btn" href="/reports/export/tickets"><Download size={15} /> <Wrench size={15} /> Maintenance Tickets</a>
            <EmailReportButton dataset="tickets" label="Maintenance Tickets" />
          </div>
        </div>
      </section>
    </div>
  );
}
