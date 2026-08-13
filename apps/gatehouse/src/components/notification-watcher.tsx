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

// Polls our own server (never the database directly from the browser —
// see the auth architecture notes elsewhere) for high-stakes events that
// happened since the last check, and surfaces them as dismissible toasts
// for anyone currently logged in, regardless of which page they're on.
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
