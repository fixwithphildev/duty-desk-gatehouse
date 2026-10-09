"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Every refresh re-runs the whole page on the server and downloads it again,
// so on a slow line it can't be too often: a refresh still loading holds back
// the page the user just clicked. 30 seconds keeps the board current without that.
const DEFAULT_MS = 30_000;

// Re-fetches the page's data now and then so what other people do (a new
// job from Duty Desk, a technician starting one) shows up without
// a reload. Never two at once, nothing while the tab is hidden, and a catch-up
// as soon as the tab is looked at again. Shows when it last updated. Anything
// typed on the page is kept: router.refresh() only swaps in fresh server data.
export function AutoRefresh({ everyMs = DEFAULT_MS }: { everyMs?: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(false);
  const lastRef = useRef(Date.now());
  pendingRef.current = pending;

  useEffect(() => {
    setUpdatedAt(new Date());
    const refresh = () => {
      if (document.visibilityState !== "visible" || pendingRef.current) return;
      lastRef.current = Date.now();
      startTransition(() => router.refresh());
      setUpdatedAt(new Date());
    };
    const interval = setInterval(refresh, everyMs);
    const onVisible = () => { if (Date.now() - lastRef.current >= everyMs) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [router, everyMs]);

  return (
    <span className="live-pill" title={`This page updates on its own every ${Math.round(everyMs / 1000)} seconds`}>
      <span className="live-dot" aria-hidden="true" />
      Live
      {updatedAt ? <span className="live-time mono">updated {updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> : null}
    </span>
  );
}
