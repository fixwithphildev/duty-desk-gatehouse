"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/types";

export interface SpendingBar {
  label: string;
  amount: number;
}

const HEIGHT = 190;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;
const GAP = 2;

// Spending per week/month/year as columns — magnitude per period, one
// series, so one colour and no legend (the card title names it). Each
// column has a hover tooltip with the exact amount; a visually hidden
// table carries the same numbers for screen readers. Plain HTML/CSS
// columns rather than SVG so the rounded tops and labels don't stretch
// with the container width.
export function SpendingChart({ data }: { data: SpendingBar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.amount));
  const plot = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="spend-chart" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
      <div className="spend-chart-plot" style={{ top: PAD_TOP, height: plot, gap: GAP }}>
        {data.map((d, i) => (
          <div
            key={d.label}
            className="spend-chart-col"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={`${d.label}: ${formatNaira(d.amount)}`}
          >
            <div
              className={`spend-chart-bar ${hover === i ? "spend-chart-bar-hover" : ""}`}
              style={{ height: d.amount > 0 ? `max(2px, ${(d.amount / max) * 100}%)` : 0 }}
            />
            {hover === i ? (
              <div className={`spend-chart-tooltip ${edgeClass(i, data.length)}`}>
                <div className="spend-chart-tooltip-label">{d.label}</div>
                <strong className="mono">{formatNaira(d.amount)}</strong>
              </div>
            ) : null}
            {(i % labelEvery === 0 && data.length - 1 - i >= labelEvery) || i === data.length - 1 ? (
              <span className={`spend-chart-axis-label ${i === 0 ? "spend-edge-start" : i === data.length - 1 && data.length > 1 ? "spend-edge-end" : ""}`} style={{ top: plot + 6 }}>{shortLabel(d.label)}</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="spend-chart-baseline" style={{ top: PAD_TOP + plot }} />
      <table className="sr-only">
        <caption>Amount spent per period</caption>
        <thead><tr><th>Period</th><th>Amount</th></tr></thead>
        <tbody>
          {data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{formatNaira(d.amount)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

// "Week of 29 Sep 2026" -> "29 Sep"; "Sep 2026" -> "Sep 26"; "2026" stays.
function shortLabel(label: string): string {
  const week = label.match(/^Week of (\d+ \w+)/);
  if (week) return week[1];
  const month = label.match(/^(\w{3}) (\d{4})$/);
  if (month) return `${month[1]} ${month[2].slice(2)}`;
  return label;
}

// Columns near either edge pin their tooltip inward so it never runs off
// the card (the current period — the one people check most — is always
// the rightmost column).
function edgeClass(i: number, count: number): string {
  if (count < 3) return "";
  if (i < count / 4) return "spend-edge-start";
  if (i >= (count * 3) / 4) return "spend-edge-end";
  return "";
}
