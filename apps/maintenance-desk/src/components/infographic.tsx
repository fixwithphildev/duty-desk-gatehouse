import Link from "next/link";

// Operations Suite report graphics. Plain SVG, no hooks, so server components can render them.

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);


export function Ring({ p, color, label, size = 92, sw = 10 }: { p: number; color: string; label: string; size?: number; sw?: number }) {
  const r = (size - sw) / 2, C = 2 * Math.PI * r, c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${p}%`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--neu-bg)" strokeWidth={sw} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(p / 100) * C} ${C}`} transform={`rotate(-90 ${c} ${c})`} />
      <text x={c} y={c + 6} textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--text)">{p}%</text>
    </svg>
  );
}

export function RingTile({ p, color, big, line }: { p: number; color: string; big: string; line: string }) {
  return (
    <div className="card ig-tile">
      <Ring p={p} color={color} label={big} />
      <div><b>{big}</b><span>{line}</span></div>
    </div>
  );
}

export interface Part {
  label: string;
  v: number;
  color: string;
  dashed?: boolean;
  href?: string;
}

function Donut({ parts, centre, sub, size = 150, sw = 22 }: { parts: Part[]; centre: string | number; sub: string; size?: number; sw?: number }) {
  const shown = parts.filter((p) => p.v);
  const tot = shown.reduce((a, p) => a + p.v, 0) || 1, r = (size - sw) / 2, C = 2 * Math.PI * r, c = size / 2;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={parts.map((p) => `${p.label} ${p.v}`).join(", ")}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--neu-bg)" strokeWidth={sw} />
      {shown.map((p) => {
        const len = (p.v / tot) * C, gap = shown.length > 1 ? Math.min(2, len / 3) : 0;
        const el = (
          <circle key={p.label} cx={c} cy={c} r={r} fill="none" stroke={p.color} strokeWidth={sw} strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-off} transform={`rotate(-90 ${c} ${c})`}>
            <title>{`${p.label}: ${p.v}`}</title>
          </circle>
        );
        off += len;
        return el;
      })}
      <text x={c} y={c + 4} textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--text)">{centre}</text>
      <text x={c} y={c + 22} textAnchor="middle" fontSize="11" fill="var(--text-3)">{sub}</text>
    </svg>
  );
}

export function DonutCard({ parts, centre, sub, fmt = (v: number) => String(v) }: { parts: Part[]; centre: string | number; sub: string; fmt?: (v: number) => string }) {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div className="don">
      <Donut parts={parts} centre={centre} sub={sub} />
      <ul>
        {parts.map((p) => (
          <li key={p.label}>
            <i style={p.dashed ? { background: "transparent", boxShadow: "inset 0 0 0 1.5px var(--line-strong)" } : { background: p.color }} />
            <span>{p.href ? <Link className="link" href={p.href}>{p.label}</Link> : p.label}</span>
            <b className="mono">{fmt(p.v)}</b>
            <span className="p">{pct(p.v, tot)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Simple labelled columns (check-outs per day, spending per week). `hi` is the
// column drawn in the accent colour (today, this week); `fmt` writes each value.
export function Columns({ cols, hi = 0, fmt = (v: number) => String(v) }: { cols: { label: string; v: number; title: string }[]; hi?: number; fmt?: (v: number) => string }) {
  const CW = 420, CH = 170, mx = Math.max(1, ...cols.map((c) => c.v)), cbw = CW / Math.max(1, cols.length);
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" role="img" aria-label={cols.map((c) => c.title).join(", ")}>
      {cols.map((c, i) => {
        const h = (c.v / mx) * (CH - 52), x = i * cbw + cbw * 0.2, w = cbw * 0.6;
        return (
          <g key={c.label}>
            <title>{c.title}</title>
            <rect x={x} y={CH - 26 - h} width={w} height={Math.max(h, 2)} rx="4" fill={i === hi ? "var(--acc)" : "var(--cat2)"} />
            <text x={x + w / 2} y={CH - 32 - h} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)">{fmt(c.v)}</text>
            <text className="chart-axis" x={x + w / 2} y={CH - 8} textAnchor="middle">{c.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
