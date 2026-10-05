import Link from "next/link";
import { Wallet, Receipt, Calculator, AlertTriangle, Download } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { formatNaira } from "@/lib/types";
import { getTickets } from "@/lib/data/tickets";
import { getCostInfoByTicket } from "@/lib/data/expenses";
import { buildSpendingReport, parseReportParams, GRANULARITIES, GRANULARITY_LABELS, type Granularity } from "@/lib/reports/spending";
import { StatCard, BarBreakdown } from "@/components/ui";
import { SpendingChart } from "@/components/spending-chart";

const PERIOD_NOUN: Record<Granularity, string> = { weekly: "week", monthly: "month", yearly: "year" };

export default async function SpendingPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requirePageAccess("/spending");
  const { granularity, from, to } = parseReportParams(searchParams);
  const [report, tickets, costs] = await Promise.all([
    buildSpendingReport(granularity, from, to),
    getTickets(),
    getCostInfoByTicket(),
  ]);

  // All-time, not limited to the selected range: resolved tickets where
  // nobody has said what was bought (typically resolved from Duty Desk).
  const missingCost = tickets.filter((t) => t.status === "Resolved" && !t.void && !costs[t.id]?.lineCount && !costs[t.id]?.noPurchase).length;

  const qs = (extra: Record<string, string>) => new URLSearchParams({ period: granularity, from, to, ...extra }).toString();

  return (
    <div className="view">
      <div className="view-head">
        <h2>Spending Reports</h2>
        <span className="cell-sub">What Maintenance bought to fix tickets, in Naira</span>
      </div>

      <form className="card spend-filters" method="get">
        <div className="spend-period-toggle" role="radiogroup" aria-label="Group by">
          {GRANULARITIES.map((g) => (
            <Link
              key={g}
              href={`/spending?period=${g}`}
              className={`spend-period-option ${g === granularity ? "spend-period-active" : ""}`}
              role="radio"
              aria-checked={g === granularity}
            >
              {GRANULARITY_LABELS[g]}
            </Link>
          ))}
        </div>
        <input type="hidden" name="period" value={granularity} />
        <label className="field spend-date">
          <span className="field-label">From</span>
          <input className="input" type="date" name="from" defaultValue={from} />
        </label>
        <label className="field spend-date">
          <span className="field-label">To</span>
          <input className="input" type="date" name="to" defaultValue={to} />
        </label>
        <button type="submit" className="btn">Apply</button>
      </form>

      <div className="stat-grid">
        <StatCard label="Total spent" value={formatNaira(report.total)} icon={Wallet} tone="orange" sub={`${from} to ${to}`} />
        <StatCard label="Tickets with purchases" value={report.ticketCount} icon={Receipt} tone="blue" sub={`${report.purchaseCount} item${report.purchaseCount === 1 ? "" : "s"} bought`} />
        <StatCard label="Average per ticket" value={formatNaira(report.averagePerTicket)} icon={Calculator} tone="neutral" />
        <StatCard
          label="Resolved, cost not recorded"
          value={missingCost}
          icon={AlertTriangle}
          tone={missingCost ? "red" : "green"}
          sub={missingCost ? "All time — see Tickets" : "All time"}
        />
      </div>

      <div className="card">
        <div className="card-head spend-card-head">
          <span>Spent per {PERIOD_NOUN[granularity]}</span>
          <span className="spend-downloads">
            <a className="btn btn-sm" href={`/spending/export?${qs({ kind: "summary" })}`}><Download size={13} /> {GRANULARITY_LABELS[granularity]} summary (CSV)</a>
            <a className="btn btn-sm" href={`/spending/export?${qs({ kind: "itemized" })}`}><Download size={13} /> Every purchase (CSV)</a>
          </span>
        </div>
        {report.purchaseCount === 0 ? (
          <p className="cell-sub" style={{ padding: "24px 0", textAlign: "center" }}>No purchases recorded in this period.</p>
        ) : (
          <SpendingChart data={report.periods.map((p) => ({ label: p.label, amount: p.amount }))} />
        )}
        <p className="cell-sub" style={{ marginBottom: 0 }}>CSV files open in Excel or Google Sheets. Amounts are in Naira (NGN).</p>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head"><span>By department</span></div>
          {report.byDepartment.length ? (
            <BarBreakdown
              items={report.byDepartment.map((d, i) => ({ label: d.label, value: d.amount, tone: i === 0 ? "orange" : "blue" }))}
              formatValue={formatNaira}
            />
          ) : <p className="cell-sub">Nothing yet.</p>}
        </div>
        <div className="card">
          <div className="card-head"><span>Top areas by spend</span></div>
          <RankedTable rows={report.topAreas} countLabel="Tickets" />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Most-bought items by spend</span></div>
        <RankedTable rows={report.topItems} countLabel="Times bought" />
      </div>

      <div className="card">
        <div className="card-head"><span>{GRANULARITY_LABELS[granularity]} breakdown</span></div>
        <p className="cell-sub" style={{ marginTop: -6, maxWidth: "none" }}>Only {PERIOD_NOUN[granularity]}s with spending are listed — the chart and the summary CSV include every {PERIOD_NOUN[granularity]}.</p>
        <div className="table-wrap">
          <table className="table spend-table">
            <thead><tr><th>{PERIOD_NOUN[granularity][0].toUpperCase() + PERIOD_NOUN[granularity].slice(1)}</th><th>Items bought</th><th>Tickets</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {report.periods.filter((p) => p.purchases > 0).reverse().map((p) => (
                <tr key={p.start}>
                  <td data-label="Period">{p.label}</td>
                  <td className="mono" data-label="Items bought">{p.purchases}</td>
                  <td className="mono" data-label="Tickets">{p.tickets}</td>
                  <td className="mono spend-amount" data-label="Amount">{formatNaira(p.amount)}</td>
                </tr>
              ))}
              <tr className="spend-total-row">
                <td data-label="Period">Total</td>
                <td className="mono" data-label="Items bought">{report.purchaseCount}</td>
                <td className="mono" data-label="Tickets">{report.ticketCount}</td>
                <td className="mono spend-amount" data-label="Amount">{formatNaira(report.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RankedTable({ rows, countLabel }: { rows: { label: string; amount: number; count: number }[]; countLabel: string }) {
  if (rows.length === 0) return <p className="cell-sub">Nothing yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table spend-table">
        <thead><tr><th>Name</th><th>{countLabel}</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td data-label="Name">{r.label}</td>
              <td className="mono" data-label={countLabel}>{r.count}</td>
              <td className="mono spend-amount" data-label="Amount">{formatNaira(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
