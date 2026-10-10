"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";

export interface Platform {
  key: "dd" | "gh" | "md";
  name: string;
  dept: string;
  desc: string;
  href: string;
  icon: "home" | "shield" | "wrench";
}

const INTRO_HOLD_MS = 3800; // how long the title stays before lifting away
const REVEAL_AFTER_INTRO_MS = 700; // page starts rising this long after the lift
const CLEANUP_MS = 3900; // by now every entrance animation has finished

const ICON_PATHS: Record<Platform["icon"], string[]> = {
  home: ["M3 11.5 12 4l9 7.5", "M5.5 10v9.5a.5.5 0 0 0 .5.5h4v-6h4v6h4a.5.5 0 0 0 .5-.5V10"],
  shield: ["M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3z", "m9 12 2 2 4-4"],
  wrench: ["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"],
};

function Icon({ name, size = 24 }: { name: Platform["icon"]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICON_PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

function greetingFor(hour: number): string {
  return hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";
}

export function Portal({ platforms }: { platforms: Platform[] }) {
  // Time-dependent text is filled in after mount so the server-rendered HTML
  // and the first client render match.
  const [now, setNow] = useState<Date | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const skipRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Coming back with the browser's Back button restores the page from cache
  // with the "Opening…" state still showing — clear it.
  useEffect(() => {
    const onShow = () => setLeaving(null);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Entrance timeline. The classes on <html> were set before first paint by
  // the script in layout.tsx; this drives them to the end state.
  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains("enter")) {
      setIntroDone(true);
      return;
    }
    const playing = html.classList.contains("intro-show");
    const timers: number[] = [];
    let frame = 0;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      try { sessionStorage.setItem("portal-intro-seen", "1"); } catch {}
      html.classList.add("intro-out");
      timers.push(window.setTimeout(() => html.classList.add("revealed"), playing ? REVEAL_AFTER_INTRO_MS : 0));
      timers.push(window.setTimeout(() => {
        html.classList.remove("enter", "revealed", "intro-show", "intro-out");
        setIntroDone(true);
      }, playing ? CLEANUP_MS : 3000));
    };
    skipRef.current = reveal;
    // Any key skips the intro (clicks/taps are handled on the intro itself).
    const onKey = () => reveal();
    if (playing) {
      timers.push(window.setTimeout(reveal, INTRO_HOLD_MS));
      window.addEventListener("keydown", onKey, { once: true });
    } else {
      // Let the hidden state paint once, then start the quick rise.
      frame = window.requestAnimationFrame(reveal);
    }
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const skipIntro = () => skipRef.current?.();

  const toggleTheme = () => {
    const root = document.documentElement;
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("portal-theme", next); } catch {}
  };

  // The card's colour spotlight follows the pointer.
  const onPointerMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const onOpen = (p: Platform) => (e: MouseEvent<HTMLAnchorElement>) => {
    setLeaving(p.key);
    if (p.href === "#") {
      // URL not configured yet (local dev) — show the state, don't navigate.
      e.preventDefault();
      window.setTimeout(() => setLeaving(null), 2500);
    }
  };

  return (
    <>
      <div className="scene" aria-hidden />

      {introDone ? null : (
        <div className="intro" aria-hidden onClick={skipIntro}>
          <div className="intro-inner">
            <div className="intro-eyebrow">Welcome to</div>
            <div className="intro-word">
              {"The Destination".split("").map((ch, i) => (
                <span key={i} className={ch === " " ? "sp" : undefined} style={{ "--i": i } as CSSProperties}>{ch === " " ? " " : ch}</span>
              ))}
            </div>
            <div className="intro-line" />
            <div className="intro-tag">Operations Portal</div>
          </div>
          <button className="intro-skip" type="button" tabIndex={-1} onClick={skipIntro}>Skip</button>
        </div>
      )}

      <div className="page">
        <div className="bar">
          <div className="brand"><div className="monogram">D</div><div className="brand-text">The Destination</div></div>
          <div className="bar-right">
            <div className="pill">
              <strong>{now ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : " "}</strong>
              <span>{now ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : ""}</span>
            </div>
            <button className="theme-btn" type="button" onClick={toggleTheme} aria-label="Switch between light and dark mode">
              <svg className="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              <svg className="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            </button>
          </div>
        </div>

        <main className="hero">
          <div className="eyebrow">Operations Portal</div>
          <h1>{now ? greetingFor(now.getHours()) : "Welcome."}</h1>
          <p className="lede">Choose your department and sign in with your username and usercode.</p>

          <nav className="cards" aria-label="Platforms">
            {platforms.map((p) => (
              <a key={p.key} className={`card ${p.key} ${leaving === p.key ? "is-leaving" : ""}`} href={p.href} onPointerMove={onPointerMove} onClick={onOpen(p)}>
                <div className="icon"><Icon name={p.icon} /></div>
                <h2>{p.name}</h2>
                <div className="tag">{p.dept}</div>
                <p>{p.desc}</p>
                <div className="cta">
                  <span>{leaving === p.key ? `Opening ${p.name}…` : "Sign in"}</span>
                  <span className="orb">
                    {leaving === p.key ? <span className="spinner" /> : (
                      <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    )}
                  </span>
                </div>
              </a>
            ))}
          </nav>
        </main>

        <footer className="foot"><span>Forgot your usercode? Ask the Admin to reset it.</span></footer>
      </div>
    </>
  );
}
