"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { aptWhere, findApartment, suggestApartments } from "@/lib/apartments";

// Type an apartment's name and pick it from the suggestions, so there are no
// typos. onChange gets the apartment's proper name once one is picked, or
// what's typed so far (so a form can refuse a name that isn't on the list).
export function ApartmentPicker({ id, value, onChange, placeholder = "Start typing the name, e.g. Lisbon" }: { id: string; value: string; onChange: (name: string) => void; placeholder?: string }) {
  const [q, setQ] = useState(value);
  const [focus, setFocus] = useState(false);
  const apt = findApartment(q.trim());
  const sugg = q.trim() && !apt ? suggestApartments(q, 8) : [];

  const set = (text: string) => {
    setQ(text);
    const a = findApartment(text.trim());
    onChange(a ? a.name : text.trim());
  };

  return (
    <div className="gsearch">
      <div className="input-wrap">
        <Search size={16} />
        <input
          id={id}
          className="input"
          value={q}
          onChange={(e) => set(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter" && !apt && sugg[0]) { e.preventDefault(); set(sugg[0].name); } }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={focus && sugg.length > 0}
          aria-controls={`${id}-sugg`}
        />
        {q ? <button type="button" className="icon-btn" style={{ position: "absolute", right: 4, width: 30, height: 30, border: 0 }} onClick={() => set("")} aria-label="Clear the apartment"><X size={14} /></button> : null}
      </div>
      {focus && q.trim() && !apt ? (
        <div className="sugg" id={`${id}-sugg`} role="listbox" aria-label="Matching apartments">
          {sugg.length ? sugg.map((s) => (
            <button key={s.name} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => { set(s.name); setFocus(false); }}>
              <b>{s.name}</b><span>{aptWhere(s)}</span>
            </button>
          )) : <div className="empty" style={{ padding: 12 }}>No apartment matches “{q.trim()}”.</div>}
        </div>
      ) : null}
      {apt ? <span className="hint">{aptWhere(apt)}</span> : null}
    </div>
  );
}
