"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Bath, BedDouble, Check, CheckCheck, CheckCircle2, Clock, CloudOff, DoorClosed, DoorOpen, Droplets,
  Lock, LogOut, Minus, Plus, Trash2, Tv, UtensilsCrossed, Wrench,
} from "lucide-react";
import { DD_ALL_ITEMS, DD_CATEGORIES, DD_CHECKLIST_TYPES, DD_TICKET_DEPTS, ticketDeptFor } from "@/lib/checklist-data";
import type { ChecklistItemInput, ChecklistType, Condition } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { discardChecklistAction, saveChecklistDraftAction, submitChecklistAction, type SaveResult } from "./actions";

export interface ItemValue {
  qty?: string;
  condition?: Condition;
  available?: "Yes" | "No";
  note?: string;
  // Department for a flagged item's ticket, when the officer changes it.
  dept?: string;
}

// Answers are batched and saved shortly after each tap, so a whole checklist
// isn't dozens of separate requests. If the connection drops, the form keeps
// the answers on screen and keeps retrying.
const SAVE_DELAY_MS = 700;
const RETRY_MS = 5_000;

type SaveState = { kind: "saved"; at: string } | { kind: "saving" } | { kind: "offline" } | { kind: "taken"; by: string } | { kind: "gone" };

const CAT_ICON: Record<string, typeof Bath> = { room: BedDouble, kitchen: UtensilsCrossed, bathroom: Bath, electronics: Tv, toiletries: Droplets };
const DEPT_TAG: Record<string, string> = { "General Maintenance": "GM", Electrician: "ELEC", "Plumbing & Building": "P&B", Painting: "PAINT", Welding: "WELD", HVAC: "HVAC", ICT: "ICT", Housekeeping: "HK" };
const isFlagged = (v: ItemValue | undefined) => v?.condition === "Damaged" || v?.condition === "Missing" || v?.available === "No";
// Where a flagged item's ticket usually goes; the officer can choose another.
const usualDept = (name: string) => ticketDeptFor(name);
const deptOf = (name: string, v: ItemValue | undefined) => (v?.dept && DD_TICKET_DEPTS.includes(v.dept) ? v.dept : usualDept(name));
const isAnswered = (v: ItemValue | undefined) => !!(v?.condition || v?.available);

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ChecklistForm({
  id,
  apartment,
  where,
  initialType,
  initialValues,
  initialReady,
  preparedByName,
  startedAt,
  savedAt,
  takenOverFrom,
}: {
  id: string;
  apartment: string;
  where: string;
  initialType: ChecklistType;
  initialValues: Record<string, ItemValue>;
  initialReady: boolean | null;
  preparedByName: string;
  startedAt: string;
  savedAt: string;
  takenOverFrom: { name: string; at: string } | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<ChecklistType>(initialType);
  const [values, setValues] = useState<Record<string, ItemValue>>(initialValues);
  // The officer's explicit final call. It starts empty and is never picked
  // for them: flagged items are shown, but the decision is theirs.
  const [ready, setReady] = useState<boolean | null>(initialReady);
  const [cat, setCat] = useState(() => DD_CATEGORIES.find((c) => c.items.some((n) => !isAnswered(initialValues[n])))?.key ?? DD_CATEGORIES[0].key);
  const [save, setSave] = useState<SaveState>({ kind: "saved", at: savedAt });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);

  // What still has to go to the server.
  const dirtyItems = useRef(new Set<string>());
  const dirtyMeta = useRef<{ type?: ChecklistType; ready?: boolean | null }>({});
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const locked = save.kind === "taken" || save.kind === "gone";

  const toInput = (name: string, v: ItemValue): ChecklistItemInput => {
    const it = DD_ALL_ITEMS.find((i) => i.name === name)!;
    return {
      name: it.name,
      category: it.categoryLabel,
      kind: it.kind,
      qty: it.hasQty ? v.qty ?? "" : null,
      condition: it.kind === "condition" ? v.condition ?? null : null,
      available: it.kind === "yesno" ? v.available ?? null : null,
      note: isFlagged(v) ? v.note ?? null : null,
      dept: isFlagged(v) ? deptOf(name, v) : null,
    };
  };

  const handleResult = (result: SaveResult) => {
    if (result.ok) setSave({ kind: "saved", at: result.savedAt });
    else if (result.reason === "taken") setSave({ kind: "taken", by: result.by });
    else setSave({ kind: "gone" });
  };

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (saving.current) {
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
      return false;
    }
    const names = [...dirtyItems.current];
    const meta = dirtyMeta.current;
    if (names.length === 0 && meta.type === undefined && meta.ready === undefined) return true;
    dirtyItems.current = new Set();
    dirtyMeta.current = {};
    saving.current = true;
    setSave({ kind: "saving" });
    try {
      const result = await callAction(saveChecklistDraftAction)({ id, items: names.map((n) => toInput(n, valuesRef.current[n] || {})), ...meta });
      handleResult(result);
      return result.ok;
    } catch {
      // Put everything back and try again shortly.
      names.forEach((n) => dirtyItems.current.add(n));
      dirtyMeta.current = { ...meta, ...dirtyMeta.current };
      setSave({ kind: "offline" });
      timer.current = setTimeout(() => void flush(), RETRY_MS);
      return false;
    } finally {
      saving.current = false;
    }
  }, [id]);

  const scheduleSave = (delay = SAVE_DELAY_MS) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  };

  // Warn before leaving with answers that haven't reached the server yet.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyItems.current.size > 0 || Object.keys(dirtyMeta.current).length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const setVal = (name: string, patch: Partial<ItemValue>, delay?: number) => {
    if (locked) return;
    setValues((v) => ({ ...v, [name]: { ...v[name], ...patch } }));
    dirtyItems.current.add(name);
    scheduleSave(delay);
  };
  const chooseType = (t: ChecklistType) => {
    if (locked) return;
    setType(t);
    dirtyMeta.current.type = t;
    scheduleSave();
  };
  const chooseReady = (r: boolean) => {
    if (locked) return;
    setReady(r);
    dirtyMeta.current.ready = r;
    scheduleSave();
  };
  // Answers only the lines in this section that haven't been answered yet.
  const markRest = (items: string[], kind: "condition" | "yesno") => {
    if (locked) return;
    const todo = items.filter((n) => !isAnswered(valuesRef.current[n]));
    if (!todo.length) return;
    const patch: Partial<ItemValue> = kind === "yesno" ? { available: "Yes" } : { condition: "Good" };
    setValues((v) => ({ ...v, ...Object.fromEntries(todo.map((n) => [n, { ...v[n], ...patch }])) }));
    todo.forEach((n) => dirtyItems.current.add(n));
    scheduleSave();
  };
  const bumpQty = (name: string, d: number) => {
    const cur = Number(values[name]?.qty || 0);
    setVal(name, { qty: String(Math.max(0, cur + d)) });
  };

  const total = DD_ALL_ITEMS.length;
  const answered = DD_ALL_ITEMS.filter((i) => isAnswered(values[i.name])).length;
  const flagged = DD_ALL_ITEMS.filter((i) => isFlagged(values[i.name]));
  const good = DD_ALL_ITEMS.filter((i) => values[i.name]?.condition === "Good" || values[i.name]?.available === "Yes").length;
  const na = DD_ALL_ITEMS.filter((i) => values[i.name]?.condition === "N/A").length;
  const left = total - answered;
  const category = DD_CATEGORIES.find((c) => c.key === cat) ?? DD_CATEGORIES[0];
  const catDone = (key: string) => DD_CATEGORIES.find((c) => c.key === key)!.items.filter((n) => isAnswered(values[n])).length;
  const catFlags = (key: string) => DD_CATEGORIES.find((c) => c.key === key)!.items.filter((n) => isFlagged(values[n])).length;
  const nextCat = DD_CATEGORIES[DD_CATEGORIES.findIndex((c) => c.key === cat) + 1];
  const r = 48, C = 2 * Math.PI * r, frac = answered / total;

  const handleSubmit = () => {
    if (ready === null || locked || left > 0) return;
    const overallReady = ready;
    setError(null);
    const items = DD_ALL_ITEMS.map((it) => toInput(it.name, values[it.name] || {}));
    startTransition(async () => {
      try {
        await flush();
        // On success the server sends you to the locked checklist, so there's no
        // result; one only comes back if it was taken over or already submitted.
        const result: SaveResult | undefined = await callAction(submitChecklistAction)({ id, type, items, overallReady });
        if (result) handleResult(result);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const stop = () => {
    startTransition(async () => {
      try {
        await callAction(discardChecklistAction)(id);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const exit = async () => {
    await flush();
    router.push("/checklists");
  };

  const typeLabel = DD_CHECKLIST_TYPES.find((t) => t.value === type)?.label ?? "Checklist";

  return (
    <>
      <div className="phead">
        <div className="t">
          <span className="over">{typeLabel} · started {fmtClock(startedAt)} · {preparedByName}{takenOverFrom ? ` · took over from ${takenOverFrom.name} at ${fmtClock(takenOverFrom.at)}` : ""}</span>
          <h1>Inspecting {apartment}</h1>
          <p>Answer every line. Damaged, missing or not-available items open a ticket when you submit, sent to the department you choose.</p>
          <div className={`save-note save-${save.kind}`} role="status" aria-live="polite" style={{ marginTop: 6 }}>
            {save.kind === "offline" ? (
              <><CloudOff size={14} /> Not saved — no connection. Keep this page open; it will keep trying.</>
            ) : save.kind === "saving" ? (
              <><Clock size={14} /> Saving…</>
            ) : save.kind === "saved" ? (
              <><CheckCircle2 size={14} /> Saved {fmtClock(save.at)} · the other officers can see you’re inspecting {apartment}. If your phone dies, open it again and carry on.</>
            ) : null}
          </div>
        </div>
        <div className="acts">
          <button type="button" className="btn btn-ghost" onClick={exit} disabled={locked}><LogOut size={15} /> Exit · it’s saved</button>
        </div>
      </div>

      {save.kind === "taken" ? (
        <div className="err-note" role="alert">
          <AlertTriangle size={16} />
          <span>{save.by} has taken over this inspection. Your answers up to now are kept in it. <button type="button" className="link" onClick={() => router.push("/checklists")}>Back to checklists</button></span>
        </div>
      ) : save.kind === "gone" ? (
        <div className="err-note" role="alert">
          <AlertTriangle size={16} />
          <span>This checklist has already been submitted or stopped. <button type="button" className="link" onClick={() => router.push(`/checklists/${id}`)}>Open it</button></span>
        </div>
      ) : null}

      <div className="insp">
        <aside className="card rail sticky">
          <div className="unit">
            <span className="over">Apartment</span>
            <b>{apartment}</b>
            <span className="muted" style={{ fontSize: 12.5 }}>{where}</span>
            <span className="hint" style={{ display: "block", marginTop: 4 }}>{total} checks · same list for every apartment</span>
          </div>
          <div className="seg" role="group" aria-label="Checklist type" style={{ margin: "4px 0 8px" }}>
            {DD_CHECKLIST_TYPES.map((t) => (
              <button key={t.value} type="button" disabled={locked} aria-pressed={type === t.value} onClick={() => chooseType(t.value)}>{t.label}</button>
            ))}
          </div>
          <div className="cats">
            {DD_CATEGORIES.map((c) => {
              const Icon = CAT_ICON[c.key] ?? Check, d = catDone(c.key), f = catFlags(c.key);
              return (
                <button key={c.key} type="button" className="catb" aria-current={cat === c.key} onClick={() => setCat(c.key)}>
                  <span className="l"><Icon size={16} />{c.label}<span className="n">{d}/{c.items.length}</span></span>
                  <span className="bar"><span style={{ width: `${(d / c.items.length) * 100}%`, background: f ? "var(--bad)" : undefined }} /></span>
                  {f ? <span className="flagn">{f} flagged</span> : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="card">
          <div className="card-h">
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <h3>{category.label}</h3>
              <span className="sub">{catDone(category.key)} of {category.items.length} answered{category.kind === "yesno" ? " · available?" : ""}</span>
            </div>
            <span className="sp" />
            {catDone(category.key) < category.items.length && !locked ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => markRest(category.items, category.kind)} title="Answers only the lines you haven't answered yet">
                <CheckCheck size={14} /> Mark the rest {category.kind === "yesno" ? "Yes" : "Good"}
              </button>
            ) : null}
            {nextCat ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCat(nextCat.key); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Next: {nextCat.label}</button> : null}
          </div>
          <div>
            {category.items.map((name) => {
              const item = DD_ALL_ITEMS.find((i) => i.name === name)!;
              const v = values[name] || {};
              const fl = isFlagged(v), done = isAnswered(v) && !fl;
              const opts = category.kind === "yesno" ? (["Yes", "No"] as const) : (["Good", "Damaged", "Missing", "N/A"] as const);
              const cur = category.kind === "yesno" ? v.available : v.condition;
              const dept = deptOf(name, v);
              return (
                <div key={name} className={`irow ${fl ? "flag" : ""} ${done ? "done" : ""}`}>
                  <div className="nm">
                    {done ? <span style={{ color: "var(--ok)" }}><CheckCircle2 size={15} /></span> : fl ? <span style={{ color: "var(--bad)" }}><AlertTriangle size={15} /></span> : <span style={{ color: "var(--text-4)" }}><Clock size={15} /></span>}
                    {name}
                    <span className="eng" title={`Goes to ${dept} if flagged`}>{DEPT_TAG[dept] ?? ""}</span>
                  </div>
                  {item.hasQty ? (
                    <div className="qty" aria-label={`Quantity for ${name}`}>
                      <button type="button" disabled={locked} onClick={() => bumpQty(name, -1)} aria-label="Fewer"><Minus size={13} /></button>
                      <input className="qty-in mono" inputMode="numeric" value={v.qty ?? ""} placeholder="–" disabled={locked} onChange={(e) => setVal(name, { qty: e.target.value.replace(/[^0-9]/g, "") })} aria-label={`How many ${name}`} />
                      <button type="button" disabled={locked} onClick={() => bumpQty(name, 1)} aria-label="More"><Plus size={13} /></button>
                    </div>
                  ) : null}
                  <div className="cond" role="radiogroup" aria-label={name}>
                    {opts.map((o) => (
                      <button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={cur === o}
                        disabled={locked}
                        className={cur === o ? `on-${o.replace("/", "")}` : ""}
                        onClick={() => setVal(name, category.kind === "yesno" ? { available: o as "Yes" | "No" } : { condition: o as Condition })}
                      >
                        {cur === o && (o === "Good" || o === "Yes") ? <Check size={12} strokeWidth={2.4} /> : null}{o}
                      </button>
                    ))}
                  </div>
                  {fl ? (
                    <div className="note" style={{ flexWrap: "wrap" }}>
                      <input className="input" style={{ flex: "1 1 200px" }} value={v.note ?? ""} disabled={locked} onChange={(e) => setVal(name, { note: e.target.value }, 1200)} placeholder="What’s wrong? This goes on the ticket" aria-label={`What's wrong with ${name}`} />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "none" }}>
                        <label className="hint" htmlFor={`dept-${name}`} style={{ whiteSpace: "nowrap" }}>Send to</label>
                        <select className="input" id={`dept-${name}`} value={dept} disabled={locked} onChange={(e) => setVal(name, { dept: e.target.value })} style={{ height: 34, width: 200, fontSize: 12.5 }}>
                          {DD_TICKET_DEPTS.map((d) => <option key={d} value={d}>{d}{d === usualDept(name) ? " (usual)" : ""}</option>)}
                        </select>
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="sum">
          <div className="card sticky">
            <div className="card-h"><h3>Summary</h3><span className="sp" /><span className="sub mono">{left} left</span></div>
            <div className="card-b vstack" style={{ gap: 18 }}>
              <div className="hstack" style={{ gap: 16, flexWrap: "nowrap" }}>
                <div className="ring">
                  <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
                    <circle cx="56" cy="56" r={r} fill="none" stroke="var(--neu-bg)" strokeWidth="10" />
                    <circle cx="56" cy="56" r={r} fill="none" stroke={flagged.length ? "var(--bad)" : "var(--ok)"} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 56 56)" />
                  </svg>
                  <b>{answered}<small>of {total}</small></b>
                </div>
                <dl className="kv" style={{ gridTemplateColumns: "auto auto", gap: "6px 14px" }}>
                  <dt>Good / Yes</dt><dd className="mono">{good}</dd>
                  <dt>Flagged</dt><dd className="mono" style={{ color: flagged.length ? "var(--bad-fg)" : "inherit", fontWeight: 600 }}>{flagged.length}</dd>
                  <dt>N/A</dt><dd className="mono">{na}</dd>
                </dl>
              </div>
              <div className="vstack">
                <span className="over">Tickets this will open</span>
                {flagged.length ? (
                  <div className="flagged">
                    {flagged.map((i) => {
                      const v = values[i.name]!, d = deptOf(i.name, v);
                      return (
                        <div key={i.name}>
                          <span style={{ color: "var(--bad)", marginTop: 1 }}><Wrench size={15} /></span>
                          <div><b>{i.name}</b><span className="muted">{v.condition ?? "Not available"} → {d}{v.note ? ` · ${v.note}` : ""}</span></div>
                        </div>
                      );
                    })}
                  </div>
                ) : <span className="hint">None yet. An item marked Damaged, Missing or No (not available) queues one, sent to the department you choose on its line.</span>}
              </div>
              <div className="vstack">
                <span className="over">Readiness decision</span>
                <div className="decide">
                  <button type="button" disabled={locked} className={ready === true ? "on-ready" : ""} onClick={() => chooseReady(true)} aria-pressed={ready === true}><DoorOpen size={16} /> Ready</button>
                  <button type="button" disabled={locked} className={ready === false ? "on-notready" : ""} onClick={() => chooseReady(false)} aria-pressed={ready === false}><DoorClosed size={16} /> Not ready</button>
                </div>
                {ready === true && flagged.length ? (
                  <div className="pill-note t-warn"><AlertTriangle size={16} /><span>You’re marking {apartment} Ready with {flagged.length} flagged item{flagged.length > 1 ? "s" : ""}. That’s recorded under your name, and the tickets still open.</span></div>
                ) : <span className="hint">You decide. The system never picks for you.</span>}
              </div>
              {error ? <div className="err-note" role="alert"><AlertTriangle size={16} /><span>{error}</span></div> : null}
              <button type="button" className="btn btn-primary btn-lg btn-block" disabled={left > 0 || ready === null || pending || locked} onClick={handleSubmit}>
                <Lock size={16} /> {pending ? "Submitting…" : "Submit and lock"}
              </button>
              <span className="hint" style={{ textAlign: "center" }}>
                {left ? `Answer the ${left} remaining line${left > 1 ? "s" : ""} to submit. Nothing is saved as N/A unless you choose it.` : ready === null ? "Choose Ready or Not ready to submit." : `Signs as ${preparedByName}. Submitted checklists can only be voided by a manager.`}
              </span>
              <hr className="sep" />
              {confirmStop ? (
                <div className="vstack" style={{ gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>Stop without submitting? {apartment} goes back to its last submitted status, and a record is kept that you stopped it.</span>
                  <div className="hstack">
                    <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={stop}><Trash2 size={13} /> Yes, stop it</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirmStop(false)}>Keep going</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" disabled={locked} onClick={() => setConfirmStop(true)} style={{ alignSelf: "flex-start" }}><Trash2 size={13} /> Stop without submitting</button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
