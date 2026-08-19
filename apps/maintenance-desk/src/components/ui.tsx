import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// No "use client" here on purpose: these are plain, stateless components
// with no hooks, so they can be rendered directly from Server Components.
// Only Drawer needs interactivity — see components/drawer.tsx.

export function Badge({ tone = "neutral", children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

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
    <div className="stat-card">
      <div className={`stat-icon tone-${tone}`}>
        <Icon size={17} />
      </div>
      <div>
        <div className="stat-value mono">{value}</div>
        <div className="stat-label">{label}</div>
        {sub ? <div className="stat-sub">{sub}</div> : null}
      </div>
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
  orange: "var(--orange-ink)",
  blue: "var(--blue-ink)",
  green: "var(--green-ink)",
  red: "var(--red-ink)",
  neutral: "var(--neutral)",
};

export interface BarBreakdownItem {
  label: string;
  value: number;
  tone?: string;
}

// Direct-labeled horizontal bars using the app's existing status tones,
// not a separate chart-only palette — keeps analytics visually consistent
// with the Badge colors used everywhere else.
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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
