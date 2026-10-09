"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Search, X } from "lucide-react";
import { DD_CHECKLIST_TYPES } from "@/lib/checklist-data";
import { aptWhere, findApartment, suggestApartments } from "@/lib/apartments";
import type { ChecklistType } from "@/lib/types";
import type { InProgressChecklist } from "@/lib/data/checklists";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { startChecklistAction } from "./actions";
import { InspectionLock } from "../inspection-lock";

// Step one of a checklist: pick the apartment (from the list, so there are no
// typos) and the type. Starting it creates the in-progress checklist straight
// away, so everyone can see the apartment is being inspected — or, if someone
// else already is, says who.
export function StartChecklist({ preparedByName, initialApartment }: { preparedByName: string; initialApartment: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialApartment);
  const [focus, setFocus] = useState(false);
  const [type, setType] = useState<ChecklistType>("check_in_prep");
  const [taken, setTaken] = useState<InProgressChecklist | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const apt = findApartment(q.trim());
  const sugg = q.trim() && !apt ? suggestApartments(q, 8) : [];

  const start = () => {
    if (!apt) return;
    setError(null);
    setTaken(null);
    startTransition(async () => {
      try {
        const result = await callAction(startChecklistAction)({ apartment: apt.name, type });
        if (result.ok) router.push(`/checklists/${result.id}`);
        else setTaken(result.taken);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <>
      <div className="phead">
        <div className="t"><span className="over">Checklists</span><h1>New checklist</h1><p>Pick the apartment. Every answer is saved as you go, so the other officers can see you’re inspecting it, and nothing is lost if your phone dies.</p></div>
        <div className="acts"><button type="button" className="btn btn-ghost" onClick={() => router.push("/checklists")}><X size={15} /> Cancel</button></div>
      </div>

      <section className="card" style={{ maxWidth: 720 }}>
        <div className="card-b vstack" style={{ gap: 18 }}>
          <div className="field">
            <label htmlFor="start-apt">Apartment</label>
            <div className="gsearch">
              <div className="input-wrap">
                <Search size={16} />
                <input
                  id="start-apt"
                  className="input"
                  style={{ height: 46, fontSize: 15 }}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setTaken(null); }}
                  onFocus={() => setFocus(true)}
                  onBlur={() => setTimeout(() => setFocus(false), 150)}
                  onKeyDown={(e) => { if (e.key === "Enter") { if (apt) start(); else if (sugg[0]) setQ(sugg[0].name); } }}
                  placeholder="Start typing the name, e.g. Lisbon"
                  autoComplete="off"
                  autoFocus
                  role="combobox"
                  aria-expanded={focus && sugg.length > 0}
                  aria-controls="start-sugg"
                />
              </div>
              {focus && q.trim() && !apt ? (
                <div className="sugg" id="start-sugg" role="listbox" aria-label="Matching apartments">
                  {sugg.length ? sugg.map((s) => (
                    <button key={s.name} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(s.name); setFocus(false); }}>
                      <b>{s.name}</b><span>{aptWhere(s)}</span>
                    </button>
                  )) : <div className="empty" style={{ padding: 12 }}>No apartment matches “{q.trim()}”.</div>}
                </div>
              ) : null}
            </div>
            <span className="hint">{apt ? aptWhere(apt) : "Pick the apartment from the list, so there are no typos."}</span>
          </div>
          <div className="field">
            <span className="flabel">Checklist</span>
            <div className="seg" role="group" aria-label="Checklist type">
              {DD_CHECKLIST_TYPES.map((t) => (
                <button key={t.value} type="button" aria-pressed={type === t.value} onClick={() => setType(t.value)}>{t.label}</button>
              ))}
            </div>
            <span className="hint">{type === "check_in_prep" ? "Decides whether front desk can sell the apartment." : "After a guest leaves. The apartment then needs a check-in prep before it can be sold."}</span>
          </div>
          <div className="field"><span className="flabel">Prepared by</span><span>{preparedByName}</span></div>
          {error ? <div className="err-note" role="alert">{error}</div> : null}
          <div><button type="button" className="btn btn-primary btn-lg" disabled={!apt || pending} onClick={start}><ClipboardCheck size={16} /> {pending ? "Starting…" : "Start checklist"}</button></div>
        </div>
      </section>

      {taken ? <InspectionLock draft={taken} canTakeOver /> : null}
    </>
  );
}
