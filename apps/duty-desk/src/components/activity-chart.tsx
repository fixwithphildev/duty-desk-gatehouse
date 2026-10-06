"use client";

import { useEffect, useRef, useState } from "react";

export interface ActivitySeries {
  key: string;
  color: string; // a CSS var, e.g. "var(--s1)"
  values: number[];
}

const H = 260;
const PAD = { l: 30, r: 92, t: 14, b: 26 };

function fmtDate(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Multi-line activity chart: one line per module, a legend that doubles as
// a show/hide toggle (with totals), direct labels at each line's end so
// identity never rests on colour alone, a crosshair tooltip, and a table
// view of the same numbers.
export function ActivityChart({ dates, series }: { dates: string[]; series: ActivitySeries[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = series.filter((s) => !hidden.has(s.key));
  const n = dates.length;
  const max = Math.max(4, ...visible.flatMap((s) => s.values));
  const top = Math.ceil(max / 4) * 4;
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (width - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const fit = Math.max(2, Math.floor((width - PAD.l - PAD.r) / 72));
  const every = Math.ceil(n / fit);

  // End labels, nudged apart so they never overlap.
  const ends = visible
    .map((s) => ({ s, y: y(s.values[n - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  // If they've been pushed below the plot (e.g. every line ends at 0), slide
  // the whole stack up so it clears the date labels.
  const overflow = ends.length ? ends[ends.length - 1].y - (H - PAD.b - 6) : 0;
  if (overflow > 0) ends.forEach((e) => (e.y -= overflow));

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (series.length - next.size > 1) next.add(key); // always keep one line
      return next;
    });

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / (width - PAD.l - PAD.r)) * (n - 1)))));
  };

  return (
    <div className="activity">
      <div className="chart-legend" role="group" aria-label="Show or hide lines">
        {series.map((s) => (
          <button key={s.key} type="button" className={`legend-chip ${hidden.has(s.key) ? "off" : ""}`} aria-pressed={!hidden.has(s.key)} onClick={() => toggle(s.key)}>
            <i style={{ background: s.color }} />
            {s.key} <b>{s.values.reduce((a, b) => a + b, 0)}</b>
          </button>
        ))}
      </div>

      <div className="chart-wrap" ref={wrapRef}>
        <svg viewBox={`0 0 ${width} ${H}`} height={H} width="100%" role="img" aria-label={`Items logged per day over the last ${n} days`}>
          {[0, 1, 2, 3, 4].map((g) => {
            const v = (top / 4) * g;
            return (
              <g key={g}>
                <line x1={PAD.l} x2={width - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
                <text className="chart-axis" x={PAD.l - 8} y={y(v) + 4} textAnchor="end">{v}</text>
              </g>
            );
          })}
          {dates.map((d, i) =>
            i % every === 0 ? (
              <text key={d} className="chart-axis" x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "middle"}>{fmtDate(d)}</text>
            ) : null
          )}
          {visible.map((s) => (
            <path key={s.key} d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {ends.map(({ s, y: ly }) => (
            <g key={s.key}>
              <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              <text className="chart-endlabel" x={x(n - 1) + 10} y={ly + 4}>{s.key}</text>
            </g>
          ))}
          {hover !== null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeDasharray="3 3" />
              {visible.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
            </g>
          ) : null}
          <rect x={PAD.l} y={PAD.t} width={Math.max(0, width - PAD.l - PAD.r)} height={H - PAD.t - PAD.b} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hover !== null ? (
          <div className={`chart-tip ${x(hover) > width * 0.6 ? "flip" : ""}`} style={{ left: `${(x(hover) / width) * 100}%` }}>
            <div className="chart-tip-date">{fmtDate(dates[hover])}</div>
            {visible.map((s) => (
              <div key={s.key} className="chart-tip-row"><i style={{ background: s.color }} />{s.key}<b>{s.values[hover]}</b></div>
            ))}
          </div>
        ) : null}
      </div>

      <button type="button" className="chart-table-toggle" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
        {showTable ? "Hide table" : "View as table"}
      </button>
      {showTable ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead><tr><th>Date</th>{series.map((s) => <th key={s.key}>{s.key}</th>)}</tr></thead>
            <tbody>
              {[...dates].reverse().map((d, ri) => {
                const i = n - 1 - ri;
                return <tr key={d}><td>{fmtDate(d)}</td>{series.map((s) => <td key={s.key}>{s.values[i]}</td>)}</tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
