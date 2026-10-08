"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_MS = 5_000;

// Re-fetches the page's data every few seconds so what other people do —
// an apartment submitted Ready, someone starting an inspection — shows up
// without a reload. Same approach as the Maintenance page. Skips while the
// tab is hidden, and shows when it last updated. Anything typed on the page
// is kept: router.refresh() only swaps in fresh server data.
export function AutoRefresh({ everyMs = DEFAULT_MS }: { everyMs?: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setUpdatedAt(new Date());
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setUpdatedAt(new Date());
    }, everyMs);
    return () => clearInterval(interval);
  }, [router, everyMs]);

  return (
    <span className="live-pill" title={`This page updates on its own every ${Math.round(everyMs / 1000)} seconds`}>
      <span className="live-dot" aria-hidden="true" />
      Live
      {updatedAt ? <span className="live-time mono">updated {updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> : null}
    </span>
  );
}
