"use client";

import { Moon, Sun } from "lucide-react";

// Flips light/dark and remembers the choice on this device. Which icon
// shows is decided in CSS (.theme-toggle), so it's right on first paint
// even before React hydrates.
export function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("md-theme", next); } catch {}
}

export function ThemeToggle({ className = "foot-btn" }: { className?: string }) {
  return (
    <button type="button" className={`${className} theme-toggle`} onClick={toggleTheme} aria-label="Switch between light and dark mode" title="Light / dark">
      <Moon size={17} className="icon-moon" />
      <Sun size={17} className="icon-sun" />
    </button>
  );
}
