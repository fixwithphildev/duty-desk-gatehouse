"use client";

import { useRef, useState } from "react";

export interface TrendPoint {
  date: string; // ISO date, e.g. "2026-08-01"
  value: number;
}

function fmtShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_X = 8;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

// Single-series trend line with a hover crosshair/tooltip, plus a visually
// hidden table so the same data is available to screen readers (per the
// dataviz skill: ship interactivity by default, and always keep a table
// fallback). One series only, so no legend is needed — the card title
// above this component names it.
export function TrendChart({ data, tone = "var(--teal)" }: { data: TrendPoint[]; tone?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = data.map((d) => d.value);
  const maxValue = Math.max(1, ...values) * 1.2;
  const stepX = data.length > 1 ? (WIDTH - PAD_X * 2) / (data.length - 1) : 0;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = data.map((d, i) => ({
    x: PAD_X + stepX * i,
    y: PAD_TOP + plotHeight - (d.value / maxValue) * plotHeight,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(1)} ${(PAD_TOP + plotHeight).toFixed(1)} L ${points[0]?.x.toFixed(1)} ${(PAD_TOP + plotHeight).toFixed(1)} Z`;

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="trend-chart" ref={containerRef} onMouseMove={onMouseMove} onMouseLeave={() => setHoverIndex(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} preserveAspectRatio="none" role="img" aria-label="Trend chart">
        <line x1={PAD_X} y1={PAD_TOP + plotHeight} x2={WIDTH - PAD_X} y2={PAD_TOP + plotHeight} stroke="var(--line)" strokeWidth={1} />
        {areaPath ? <path d={areaPath} fill={tone} opacity={0.12} stroke="none" /> : null}
        {linePath ? <path d={linePath} fill="none" stroke={tone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={p.x} y={HEIGHT - 4} textAnchor="middle" className="trend-chart-axis-label">
              {fmtShort(p.date)}
            </text>
          ) : null
        )}
        {hovered ? (
          <>
            <line x1={hovered.x} y1={PAD_TOP} x2={hovered.x} y2={PAD_TOP + plotHeight} stroke="var(--line)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill={tone} stroke="var(--surface)" strokeWidth={2} />
          </>
        ) : null}
      </svg>
      {hovered ? (
        <div className="trend-chart-tooltip" style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}>
          {fmtShort(hovered.date)}: <strong>{hovered.value}</strong>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>Daily values</caption>
        <thead><tr><th>Date</th><th>Value</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}><td>{fmtShort(d.date)}</td><td>{d.value}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
