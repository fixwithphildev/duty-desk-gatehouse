"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

interface ToastItem {
  id: string;
  message: string;
  href: string;
}

const POLL_MS = 15_000;
const AUTO_DISMISS_MS = 12_000;

// A short two-note chime, synthesized with the Web Audio API rather than
// an audio file — nothing to host, nothing to load. Browsers block audio
// from playing until the page has had some user interaction (logging in
// counts), so this can occasionally be silent on a very first check after
// a fresh page load; the visual toast still shows either way.
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Web Audio unavailable/blocked — the visual toast still shows.
  }
}

// Polls our own server (never the database directly from the browser) for
// events that happened since the last check, and surfaces them as
// dismissible toasts for anyone currently logged in, regardless of which
// page they're on.
export function NotificationWatcher() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const sinceRef = useRef(new Date().toISOString());

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/notifications?since=${encodeURIComponent(sinceRef.current)}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: { items: ToastItem[]; checkedAt: string } = await res.json();
        sinceRef.current = data.checkedAt;
        if (data.items.length === 0) return;

        playChime();
        setToasts((prev) => [...data.items, ...prev].slice(0, 5));
        data.items.forEach((item) => {
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== item.id));
          }, AUTO_DISMISS_MS);
        });
      } catch {
        // Transient network hiccup — just try again next interval.
      }
    };

    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="notification-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="notification-toast"
          onClick={() => {
            router.push(t.href);
            dismiss(t.id);
          }}
        >
          <AlertTriangle size={15} />
          <span className="notification-toast-msg">{t.message}</span>
          <button
            type="button"
            className="notification-toast-close"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
