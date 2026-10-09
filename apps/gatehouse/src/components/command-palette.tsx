"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";

export interface PaletteItem {
  label: string;
  sub?: string;
  href: string;
  group: string;
  // Extra words to match on (e.g. an apartment's building and floor).
  keywords?: string;
}

// Ctrl/⌘ K search: pages, apartments and anything else the layout passes in.
export function CommandPalette({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const hit = (i: PaletteItem) => !s || `${i.label} ${i.sub ?? ""} ${i.keywords ?? ""} ${i.group}`.toLowerCase().includes(s);
    const starts = (i: PaletteItem) => (s && i.label.toLowerCase().startsWith(s) ? 0 : 1);
    return items.filter(hit).sort((a, b) => starts(a) - starts(b)).slice(0, s ? 30 : 12);
  }, [q, items]);

  useEffect(() => { setActive(0); }, [q]);

  const go = (i: PaletteItem | undefined) => {
    if (!i) return;
    onClose();
    router.push(i.href);
  };

  const groups: string[] = [];
  for (const r of results) if (!groups.includes(r.group)) groups.push(r.group);

  return (
    <div className="palette-wrap" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="pi">
          <Search size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search apartments, pages…"
            aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter") go(results[active]);
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <ul>
          {results.length === 0 ? <li className="empty">Nothing matches “{q}”.</li> : null}
          {groups.map((g) => (
            <li key={g} style={{ display: "contents" }}>
              <div className="pal-g" role="presentation">{g}</div>
              {results.filter((r) => r.group === g).map((r) => {
                const idx = results.indexOf(r);
                return (
                  <button key={`${r.group}-${r.href}-${r.label}`} type="button" className={idx === active ? "act" : ""} onMouseEnter={() => setActive(idx)} onClick={() => go(r)}>
                    <span className="pal-tx"><b>{r.label}</b>{r.sub ? <span>{r.sub}</span> : null}</span>
                    <span className="pal-go"><ArrowRight size={14} /></span>
                  </button>
                );
              })}
            </li>
          ))}
        </ul>
        <div className="pal-foot"><span><span className="kbd">↑</span> <span className="kbd">↓</span> to move</span><span><span className="kbd">Enter</span> to open</span><span><span className="kbd">Esc</span> to close</span></div>
      </div>
    </div>
  );
}
