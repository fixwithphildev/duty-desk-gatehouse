"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// The suite's side panel: a small label above the title, an optional line
// under it, the form in the middle and the buttons pinned to the bottom.
export function Drawer({
  open,
  onClose,
  title,
  over,
  sub,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  over?: string;
  sub?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-h">
          <div className="vstack" style={{ gap: 4, flex: 1 }}>
            {over ? <span className="over">{over}</span> : null}
            <h2>{title}</h2>
            {sub ? <span className="muted" style={{ fontSize: 12.5 }}>{sub}</span> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="drawer-b">{children}</div>
        {footer ? <div className="drawer-f">{footer}</div> : null}
      </aside>
    </div>
  );
}
