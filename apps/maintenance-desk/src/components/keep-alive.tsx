"use client";

import { useEffect } from "react";

const EVERY_MS = 60_000;

// While someone is using the app (tapping, typing, scrolling), renew their
// sign-in at most once a minute. Pages refreshing on their own don't count,
// so a shared computer left alone still signs out after 20 minutes.
export function KeepAlive() {
  useEffect(() => {
    let last = Date.now();
    const onActivity = () => {
      if (Date.now() - last < EVERY_MS) return;
      last = Date.now();
      fetch("/api/keep-alive", { method: "POST", credentials: "same-origin" }).catch(() => {});
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, []);
  return null;
}
