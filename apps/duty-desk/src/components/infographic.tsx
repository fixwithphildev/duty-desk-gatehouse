import Link from "next/link";
import { MAIN_FLOORS, STUDIO_FLOORS, WINGS } from "@/lib/apartments";
import type { BoardApt } from "@/lib/board";

// Operations Suite report graphics. Plain SVG, no hooks, so server components can render them.

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export const STATUS_COLOR: Record<string, string> = {
  ready: "var(--ok)",
  recheck: "var(--warn)",
  notready: "var(--bad)",
  inspecting: "var(--info)",
  unchecked: "var(--line-strong)",
  occupied: "var(--neu)",
};

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

export function DonutCard({ parts, centre, sub }: { parts: Part[]; centre: string | number; sub: string }) {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div className="don">
      <Donut parts={parts} centre={centre} sub={sub} />
      <ul>
        {parts.map((p) => (
          <li key={p.label}>
            <i style={p.dashed ? { background: "transparent", boxShadow: "inset 0 0 0 1.5px var(--line-strong)" } : { background: p.color }} />
            <span>{p.href ? <Link className="link" href={p.href}>{p.label}</Link> : p.label}</span>
            <b className="mono">{p.v}</b>
            <span className="p">{pct(p.v, tot)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Check-in preps per day: Ready (green) under Not ready (red).
export function PrepBars({ preps }: { preps: { date: string; ready: number; not: number }[] }) {
  const W = 620, H = 190, L = 28, B = 22, n = preps.length, bw = (W - L) / Math.max(1, n);
  const mx = Math.max(1, ...preps.map((p) => p.ready + p.not)), step = Math.ceil(n / 14);
  const y = (v: number) => H - B - (v / mx) * (H - B - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Check-in preps per day, ready and not ready">
      {[...new Set([0, Math.round(mx / 2), mx])].map((v) => (
        <g key={v}><line className="chart-grid" x1={L} x2={W} y1={y(v)} y2={y(v)} /><text className="chart-axis" x={L - 8} y={y(v) + 3} textAnchor="end">{v}</text></g>
      ))}
      {preps.map((p, i) => {
        const x = L + i * bw + bw * 0.18, w = Math.max(1, bw * 0.64), hR = H - B - y(p.ready), hN = H - B - y(p.not);
        return (
          <g key={p.date}>
            <title>{`${p.date}: ${p.ready} ready, ${p.not} not ready`}</title>
            {p.ready ? <rect x={x} y={H - B - hR} width={w} height={hR} rx="2" fill="var(--ok)" /> : null}
            {p.not ? <rect x={x} y={H - B - hR - hN} width={w} height={Math.max(0, hN - 1.5)} rx="2" fill="var(--bad)" /> : null}
            {i % step === 0 ? <text className="chart-axis" x={x + w / 2} y={H - 6} textAnchor="middle">{Number(p.date.slice(8))}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

// Simple labelled columns (check-outs per day).
export function Columns({ cols }: { cols: { label: string; v: number; title: string }[] }) {
  const CW = 420, CH = 170, mx = Math.max(1, ...cols.map((c) => c.v)), cbw = CW / Math.max(1, cols.length);
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" role="img" aria-label={cols.map((c) => c.title).join(", ")}>
      {cols.map((c, i) => {
        const h = (c.v / mx) * (CH - 52), x = i * cbw + cbw * 0.2, w = cbw * 0.6;
        return (
          <g key={c.label}>
            <title>{c.title}</title>
            <rect x={x} y={CH - 26 - h} width={w} height={Math.max(h, 2)} rx="4" fill={i === 0 ? "var(--acc)" : "var(--cat2)"} />
            <text x={x + w / 2} y={CH - 32 - h} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)">{c.v}</text>
            <text className="chart-axis" x={x + w / 2} y={CH - 8} textAnchor="middle">{c.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Every apartment as one square, by building and floor. Each opens it on the board.
export function DotMatrix({ apts }: { apts: BoardApt[] }) {
  const dot = (a: BoardApt) => <Link key={a.name} href={`/board?apt=${encodeURIComponent(a.name)}`} className={`dot ${a.status}`} title={`${a.name} · ${a.label}`} aria-label={`${a.name}: ${a.label}`} />;
  const main = apts.filter((a) => a.building === "Main Building");
  return (
    <div className="dots2">
      <div className="dots">
        <span className="bh">Main Building · floors 7 to G</span>
        {MAIN_FLOORS.map((f) => (
          <div key={f} className="fr"><span className="fl">{f === "G" ? "G" : `L${f}`}</span><div className="cells">{main.filter((a) => a.floor === f).map(dot)}</div></div>
        ))}
      </div>
      <div className="dots">
        <span className="bh">Studio Wings · wings {WINGS.map((w) => w.slice(-1)).join(" ")}</span>
        {STUDIO_FLOORS.map((f) => (
          <div key={f} className="fr">
            <span className="fl">L{f}</span>
            <div className="cells">
              {WINGS.map((w, i) => (
                <span key={w} style={{ display: "contents" }}>
                  {i ? <span className="wing-gap" /> : null}
                  {apts.filter((a) => a.building === w && a.floor === f).map(dot)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusLegend({ counts }: { counts: Record<string, number> }) {
  const items: [string, string][] = [["ready", "Ready to sell"], ["recheck", "Re-check"], ["notready", "Not ready"], ["inspecting", "Inspecting"], ["unchecked", "Needs checklist"], ["occupied", "Occupied"]];
  return (
    <div className="legend">
      {items.map(([k, l]) => <span key={k}><i style={k === "unchecked" ? { border: "1px dashed var(--line-strong)" } : { background: STATUS_COLOR[k] }} />{l} {counts[k] ?? 0}</span>)}
    </div>
  );
}
