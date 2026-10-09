import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Small Operations Suite building blocks. No hooks, so Server Components can use them directly.

export type Tone = "ok" | "warn" | "bad" | "info" | "neu" | "acc";

export function Badge({ tone = "neu", dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={`badge t-${tone}`}>{dot ? <span className="d" /> : null}{children}</span>;
}

export const priTone = (p: string): Tone => (p === "High" ? "bad" : p === "Medium" ? "warn" : "info");
export const stTone = (s: string): Tone => (["Resolved", "Done"].includes(s) ? "ok" : s === "In Progress" ? "info" : ["Open", "Reported", "Pending"].includes(s) ? "warn" : "neu");

// A tiny line chart for a KPI tile.
export function Spark({ values, tone = "acc" }: { values: number[]; tone?: string }) {
  if (values.length < 2) return null;
  const w = 72, h = 24, mx = Math.max(...values), mn = Math.min(...values), r = mx - mn || 1;
  const pts = values.map((v, i) => [i * (w / (values.length - 1)), h - 3 - ((v - mn) / r) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill={`var(--${tone})`} opacity=".10" />
      <path d={d} fill="none" stroke={`var(--${tone})`} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={`var(--${tone})`} />
    </svg>
  );
}

export function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  ctx,
  data,
  tile,
  sparkTone = "acc",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  ctx?: ReactNode;
  data?: number[];
  tile?: "bad" | "warn" | "";
  sparkTone?: string;
}) {
  return (
    <div className="card kpi">
      <div className="h"><div className={`ti ${tile ?? ""}`}><Icon size={16} /></div>{label}</div>
      <div className="v">{value}{unit ? <small>{unit}</small> : null}</div>
      <div className="f"><span>{ctx}</span>{data ? <Spark values={data} tone={sparkTone} /> : null}</div>
    </div>
  );
}

export function PageHead({ title, sub, over, children }: { title: ReactNode; sub?: ReactNode; over?: ReactNode; children?: ReactNode }) {
  return (
    <div className="phead">
      <div className="t">
        {over ? <span className="over">{over}</span> : null}
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="acts">{children}</div> : null}
    </div>
  );
}
