"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCircle2, Volume2, X } from "lucide-react";
import { allowSound, playChime } from "./alert-sound";

interface Item {
  id: string;
  message: string;
  href: string;
  createdAt: string;
  tone?: "alert" | "good";
}

// New jobs and requests show within this long.
const POLL_MS = 15_000;
const AUTO_DISMISS_MS = 12_000;
const HISTORY_HOURS = 24;
const SEEN_KEY = "md-notifications-seen";

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
// directly from the browser) every 15 seconds for high-stakes events,
// pops each new one up with a chime, and keeps the last day's events in the
// bell's list. Unread = newer than when this device last opened the list.
export function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [toasts, setToasts] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  // Result of the last Test sound tap, so someone can check their phone before an alert comes.
  const [soundTest, setSoundTest] = useState<"ok" | "blocked" | null>(null);
  const [seen, setSeen] = useState<string>(new Date(0).toISOString());
  // Where the next check starts. Set from the server's answer (never this
  // device's clock, which may be off); each answer starts a minute back, so
  // nothing saved mid-check slips between two checks.
  const sinceRef = useRef(new Date().toISOString());
  // Every event already in the list or announced, so the overlap never repeats one.
  const knownRef = useRef(new Set<string>());

  useEffect(() => {
    setSeen(readSeen());
    let cancelled = false;
    const load = async (since: string, announce: boolean) => {
      try {
        const res = await fetch(`/api/notifications?since=${encodeURIComponent(since)}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: { items: Item[]; checkedAt: string } = await res.json();
        sinceRef.current = data.checkedAt;
        const fresh = data.items.filter((i) => !knownRef.current.has(i.id));
        fresh.forEach((i) => knownRef.current.add(i.id));
        if (fresh.length === 0) return;
        setItems((prev) => [...fresh.slice().reverse(), ...prev].slice(0, 40));
        if (announce) {
          void playChime();
          setToasts((prev) => [...fresh, ...prev].slice(0, 4));
          fresh.forEach((item) => setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== item.id)), AUTO_DISMISS_MS));
        }
      } catch {
        // Transient network hiccup — just try again next time.
      }
    };
    // One check at a time: on a slow line, overlapping checks queue up and
    // hold back the page the user clicked. It keeps checking while the tab is
    // in the background (the browser slows it to about once a minute), so
    // front desk still hears the chime with another window in front.
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try { await load(sinceRef.current, true); } finally { busy = false; }
    };
    // Phones stop a page running while it's in the background or the screen is
    // locked; coming back catches up straight away with whatever was missed.
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    // Phones only let a page make sound after a tap: the first one allows the chime.
    const unlock = () => allowSound();
    const first = load(new Date(Date.now() - HISTORY_HOURS * 3600_000).toISOString(), false);
    const interval = setInterval(() => void first.then(poll), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    // iPhones and iPads count the end of a tap (or a click) as the go-ahead, other browsers the press.
    const UNLOCK = ["pointerdown", "touchend", "click", "keydown"] as const;
    UNLOCK.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      UNLOCK.forEach((e) => window.removeEventListener(e, unlock));
    };
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

  // A tap is what phones need to allow sound, so the test both checks and allows it.
  const testSound = async () => setSoundTest((await playChime()) ? "ok" : "blocked");

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
            <div className="nf-f">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void testSound()}><Volume2 size={14} /> Test sound</button>
              <span className="hint" role="status">
                {soundTest === "ok" ? "Did you hear it? If not, turn up the media volume." : soundTest === "blocked" ? "This browser blocked the sound. Alerts still pop up." : "New alerts chime and pop up."}
              </span>
            </div>
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
