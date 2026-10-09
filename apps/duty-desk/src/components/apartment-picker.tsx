"use client";

import { useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { aptWhere, findApartment, suggestApartments } from "@/lib/apartments";

// Pick one or more apartments: type a name, choose it from the suggestions
// (so there are no typos), and it's added as a tag that can be removed.
// onTyping reports text that's typed but not picked yet, so a form can say so.
export function ApartmentsPicker({
  id,
  value,
  onChange,
  onTyping,
  placeholder = "Start typing the name, e.g. Lisbon",
}: {
  id: string;
  value: string[];
  onChange: (names: string[]) => void;
  onTyping?: (text: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const sugg = q.trim() ? suggestApartments(q, 8).filter((a) => !value.includes(a.name)) : [];

  const type = (text: string) => {
    setQ(text);
    onTyping?.(text);
  };
  const add = (name: string) => {
    const a = findApartment(name);
    if (a && !value.includes(a.name)) onChange([...value, a.name]);
    type("");
  };

  return (
    <div className="vstack" style={{ gap: 8 }}>
      {value.length ? (
        <div className="hstack" style={{ gap: 6 }}>
          {value.map((n) => (
            <span key={n} className="badge t-acc" style={{ height: 28, paddingRight: 4 }}>
              <MapPin size={12} /> {n}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== n))} aria-label={`Remove ${n}`} style={{ border: 0, background: "transparent", color: "inherit", display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 6, cursor: "pointer" }}><X size={12} /></button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="gsearch">
        <div className="input-wrap">
          <Search size={16} />
          <input
            id={id}
            className="input"
            value={q}
            onChange={(e) => type(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const exact = findApartment(q.trim());
              if (exact) add(exact.name);
              else if (sugg[0]) add(sugg[0].name);
            }}
            placeholder={value.length ? "Add another apartment" : placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={focus && sugg.length > 0}
            aria-controls={`${id}-sugg`}
          />
        </div>
        {focus && q.trim() ? (
          <div className="sugg" id={`${id}-sugg`} role="listbox" aria-label="Matching apartments">
            {sugg.length ? sugg.map((s) => (
              <button key={s.name} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => add(s.name)}>
                <b>{s.name}</b><span>{aptWhere(s)}</span>
              </button>
            )) : <div className="empty" style={{ padding: 12 }}>No apartment matches “{q.trim()}”.</div>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
