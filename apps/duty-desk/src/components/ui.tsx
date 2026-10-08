import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// No "use client" here on purpose: these are plain, stateless components
// with no hooks, so they can be rendered directly from Server Components
// (e.g. the Dashboard passing a Lucide icon component into StatCard).
// Only Drawer needs interactivity — see components/drawer.tsx.

export function Badge({ tone = "neutral", children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// Label + icon on top, a large serif figure underneath. `tone` colours the
// figure (red = needs action, gold = open items, teal = all clear).
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: string;
  sub?: string;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon"><Icon size={16} /></span>
      </div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <Icon size={26} strokeWidth={1.5} />
      <div className="empty-title">{title}</div>
      {hint ? <div className="empty-hint">{hint}</div> : null}
    </div>
  );
}

const TONE_VARS: Record<string, string> = {
  teal: "var(--teal)",
  gold: "var(--gold)",
  red: "var(--red)",
  neutral: "var(--neutral)",
};

export interface BarBreakdownItem {
  label: string;
  value: number;
  tone?: string;
}

// Direct-labeled horizontal bars using the app's existing status tones
// (teal/gold/red), not a separate chart-only palette — keeps analytics
// visually consistent with the Badge colors used everywhere else.
export function BarBreakdown({ items }: { items: BarBreakdownItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bar-breakdown">
      {items.map((item) => (
        <div className="bar-breakdown-row" key={item.label}>
          <span className="bar-breakdown-label">{item.label}</span>
          <div className="bar-breakdown-track">
            <div
              className="bar-breakdown-fill"
              style={{ width: `${(item.value / max) * 100}%`, background: TONE_VARS[item.tone ?? "neutral"] ?? TONE_VARS.neutral }}
            />
          </div>
          <span className="mono bar-breakdown-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// The label wraps the control, so tapping the label focuses it.
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field field-wrap">
      <span className="flabel">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}
