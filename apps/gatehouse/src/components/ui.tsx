import type { ReactNode } from "react";

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
