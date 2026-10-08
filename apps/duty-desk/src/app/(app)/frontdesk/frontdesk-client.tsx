"use client";

import { useMemo, useState } from "react";
import { Search, DoorOpen, DoorClosed, Lock, Bell } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { suggestApartments, findApartment } from "@/lib/apartments";
import type { BoardApt } from "@/lib/board";

const GROUPS: [string, (a: BoardApt) => boolean][] = [
  ["Studio", (a) => a.type === "Studio"],
  ["2 Bedroom", (a) => a.type === "2 Bedroom"],
  ["3 Bedroom", (a) => a.type === "3 Bedroom"],
  ["4 Bedroom", (a) => a.type === "4 Bedroom"],
];
const loc = (a: BoardApt) => (a.type === "Studio" ? `L${a.floor} ${a.building.slice(-1)}` : a.floor === "G" ? "G" : `L${a.floor}`);

export function FrontDeskClient({ apts, justReady, readyDays, initialApt }: { initialApt: string; apts: BoardApt[]; justReady: { name: string; type: string; at: string; by: string }[]; readyDays: number }) {
  const [q, setQ] = useState(initialApt);
  const [focus, setFocus] = useState(false);
  const byName = useMemo(() => new Map(apts.map((a) => [a.name, a])), [apts]);
  const ready = apts.filter((a) => a.status === "ready");
  const occupied = apts.filter((a) => a.status === "occupied").length;
  const typed = q.trim(), found = findApartment(typed), a = found ? byName.get(found.name) : undefined;
  const sugg = typed && !found ? suggestApartments(typed) : [];
  const pick = (name: string) => { setQ(name); setFocus(false); document.getElementById("fd-lookup")?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  const why = (x: BoardApt) =>
    x.status === "occupied" ? "A guest is staying"
      : x.status === "notready" ? "Repair in progress"
      : x.status === "recheck" ? "Its Ready check has expired; it needs checking again"
      : x.status === "inspecting" ? "Being checked by a Resident Officer right now"
      : "Being prepared by the Resident Officer";

  return (
    <>
      <div className="phead">
        <div className="t">
          <h1>Apartments you can sell</h1>
          <p>Only apartments a Resident Officer has checked and marked Ready in the last {readyDays} days. This page updates on its own; nothing here can be changed.</p>
        </div>
        <div className="acts"><span className="badge t-ok"><span className="d" />{ready.length} ready to sell</span><AutoRefresh /></div>
      </div>

      {justReady.length ? (
        <section className="card">
          <div className="card-h"><Bell size={16} /><h3>Became ready today</h3><span className="sp" /><span className="sub">newest first</span></div>
          <ul className="list">
            {justReady.map((j) => (
              <li key={j.name} className="row click" onClick={() => pick(j.name)}>
                <span className="stripe s-ok" />
                <div className="m"><b>{j.name}</b><span>{j.type} · checked by {j.by} at {j.at}</span></div>
                <span className="badge t-ok">Ready to sell</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card gate" id="fd-lookup">
        <div className="q">
          <span className="over">Can I sell this apartment?</span>
          <div className="gsearch">
            <div className="input-wrap">
              <Search size={20} />
              <input className="input big" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} placeholder="Type the apartment name" aria-label="Apartment name" autoComplete="off" role="combobox" aria-expanded={focus && sugg.length > 0} aria-controls="fd-sugg" />
            </div>
            {focus && typed && !found ? (
              <div className="sugg" id="fd-sugg" role="listbox" aria-label="Matching apartments">
                {sugg.length ? sugg.map((s) => (
                  <button key={s.name} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s.name)}>
                    <b>{s.name}</b><span>{byName.get(s.name)?.where}</span>
                  </button>
                )) : <div className="empty" style={{ padding: 12 }}>No apartment matches “{typed}”.</div>}
              </div>
            ) : null}
          </div>
          <span className="hint">Pick the apartment from the list, so there are no typos.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {!typed ? (
            <div className="res neu"><div className="ri"><Search size={24} /></div><div><div className="verdict muted">Can I sell it?</div><h3>Type the apartment name</h3></div></div>
          ) : !a ? (
            <div className="res neu"><div className="ri"><Search size={24} /></div><div><div className="verdict muted">Pick from the list</div><h3>Choose the apartment under the search box</h3></div></div>
          ) : a.status === "ready" ? (
            <div className="res ok"><div className="ri"><DoorOpen size={26} /></div><div className="vstack" style={{ gap: 4 }}><div className="verdict">Yes · ready to sell</div><h3>{a.name}</h3><span style={{ fontSize: 13, color: "var(--text-2)" }}>{a.where}</span><span className="hint">{a.detail.split(". You don’t")[0]}.</span></div></div>
          ) : (
            <div className="res bad"><div className="ri"><DoorClosed size={26} /></div><div className="vstack" style={{ gap: 4 }}><div className="verdict">No · don’t sell</div><h3>{a.name}</h3><span style={{ fontSize: 13, color: "var(--text-2)" }}>{a.where}</span><span style={{ fontSize: 13, color: "var(--text-2)" }}>{why(a)}. If a guest needs it, call the Resident Officer on duty.</span></div></div>
          )}
        </div>
      </section>

      <div className="g fd-cols">
        {GROUPS.map(([t, f]) => {
          const list = ready.filter(f);
          if (!list.length) return null;
          return (
            <section key={t} className="card">
              <div className="card-h"><h3>{t}</h3><span className="sp" /><span className="badge t-ok"><span className="d" />{list.length} ready</span></div>
              <div className="fd-chips">{list.map((x) => <button key={x.name} type="button" className="fd-chip" onClick={() => pick(x.name)}><b>{x.name}</b><span className="mono">{loc(x)}</span></button>)}</div>
            </section>
          );
        })}
      </div>
      {ready.length === 0 ? <div className="card empty">No apartment is ready to sell right now. Call the Resident Officer on duty.</div> : null}

      <div className="pill-note" style={{ background: "var(--subtle)", border: "1px solid var(--line)" }}>
        <Lock size={16} />
        <span>{apts.length - ready.length} apartments can’t be sold right now{occupied ? `: ${occupied} occupied and ${apts.length - ready.length - occupied} being checked or repaired` : ""}. If a guest needs one of them, call the Resident Officer on duty.</span>
      </div>
    </>
  );
}
