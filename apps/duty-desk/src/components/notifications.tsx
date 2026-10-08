"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCircle2, X } from "lucide-react";

interface Item {
  id: string;
  message: string;
  href: string;
  createdAt: string;
  tone?: "alert" | "good";
}

const POLL_MS = 5_000;
const AUTO_DISMISS_MS = 12_000;
const HISTORY_HOURS = 24;
const SEEN_KEY = "dd-notifications-seen";

// A short two-note chime, synthesized with the Web Audio API rather than an
// audio file. Browsers block audio until the page has had some interaction
// (signing in counts), so the very first alert after a fresh load can be
// silent; the pop-up still shows either way.
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
    // Web Audio unavailable/blocked — the pop-up still shows.
  }
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function readSeen(): string {
  try { return localStorage.getItem(SEEN_KEY) ?? new Date(0).toISOString(); } catch { return new Date(0).toISOString(); }
}

// The bell in the top bar. Polls our own server (never the database
// directly from the browser) every few seconds for high-stakes events,
// pops each new one up with a chime, and keeps the last day's events in the
// bell's list. Unread = newer than when this device last opened the list.
export function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [toasts, setToasts] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string>(new Date(0).toISOString());
  const sinceRef = useRef(new Date().toISOString());

  useEffect(() => {
    setSeen(readSeen());
    let cancelled = false;
    const load = async (since: string, announce: boolean) => {
      try {
        const res = await fetch(`/api/notifications?since=${encodeURIComponent(since)}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: { items: Item[]; checkedAt: string } = await res.json();
        if (announce) sinceRef.current = data.checkedAt;
        if (data.items.length === 0) return;
        setItems((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...data.items.filter((i) => !ids.has(i.id)).reverse(), ...prev].slice(0, 40);
        });
        if (announce) {
          playChime();
          setToasts((prev) => [...data.items, ...prev].slice(0, 4));
          data.items.forEach((item) => setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== item.id)), AUTO_DISMISS_MS));
        }
      } catch {
        // Transient network hiccup — just try again next time.
      }
    };
    void load(new Date(Date.now() - HISTORY_HOURS * 3600_000).toISOString(), false);
    const interval = setInterval(() => void load(sinceRef.current, true), POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const unread = items.filter((i) => i.createdAt > seen).length;

  const toggle = () => {
    setOpen((o) => !o);
    setToasts([]);
    const now = new Date().toISOString();
    setSeen(now);
    try { localStorage.setItem(SEEN_KEY, now); } catch {}
  };

  const go = (i: Item) => { setOpen(false); setToasts((prev) => prev.filter((t) => t.id !== i.id)); router.push(i.href); };
  const Icon = ({ i }: { i: Item }) => (i.tone === "good" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />);

  return (
    <>
      <button type="button" className={`icon-btn nbell ${open ? "on" : ""}`} onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Bell size={18} />
        {unread ? <span className="nb-count">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      {open ? (
        <div className="nf-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="nf-panel" role="dialog" aria-label="Notifications">
            <div className="nf-h"><h3>Notifications</h3><span className="sub muted" style={{ fontSize: 12.5 }}>last {HISTORY_HOURS} hours</span><span style={{ flex: 1 }} />
              <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setOpen(false)} aria-label="Close"><X size={15} /></button>
            </div>
            <ul className="list" style={{ overflowY: "auto" }}>
              {items.length === 0 ? <li className="empty">Nothing needs your attention right now.</li> : null}
              {items.map((i) => (
                <li key={i.id}>
                  <button type="button" className="row click nf-row" onClick={() => go(i)}>
                    <span className={`nf-ic ${i.tone === "good" ? "good" : "alert"}`}><Icon i={i} /></span>
                    <span className="m"><b style={{ whiteSpace: "normal" }}>{i.message}</b></span>
                    <span className="age">{ago(i.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {toasts.length ? (
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.tone === "good" ? "good" : "alert"}`} onClick={() => go(t)} role="button" tabIndex={0}>
              <Icon i={t} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button type="button" className="toast-x" onClick={(e) => { e.stopPropagation(); setToasts((prev) => prev.filter((x) => x.id !== t.id)); }} aria-label="Dismiss"><X size={13} /></button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
