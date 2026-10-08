"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudOff, LogOut, Trash2 } from "lucide-react";
import { Field } from "@/components/ui";
import { DD_ALL_ITEMS, DD_CATEGORIES, DD_CHECKLIST_TYPES, DD_CONDITIONS } from "@/lib/checklist-data";
import type { ChecklistItemInput, ChecklistType, Condition } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { discardChecklistAction, saveChecklistDraftAction, submitChecklistAction, type SaveResult } from "./actions";

export interface ItemValue {
  qty?: string;
  condition?: Condition;
  available?: "Yes" | "No";
}

// Answers are batched and saved shortly after each tap, so a whole checklist
// isn't dozens of separate requests. If the connection drops, the form keeps
// the answers on screen and keeps retrying.
const SAVE_DELAY_MS = 700;
const RETRY_MS = 5_000;

type SaveState = { kind: "saved"; at: string } | { kind: "saving" } | { kind: "offline" } | { kind: "taken"; by: string } | { kind: "gone" };

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function ChecklistForm({
  id,
  apartment,
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

  const toInput = (name: string, v: ItemValue, fillDefaults: boolean): ChecklistItemInput => {
    const it = DD_ALL_ITEMS.find((i) => i.name === name)!;
    return {
      name: it.name,
      category: it.categoryLabel,
      kind: it.kind,
      qty: it.hasQty ? v.qty ?? "" : null,
      condition: it.kind === "condition" ? v.condition ?? (fillDefaults ? "N/A" : null) : null,
      available: it.kind === "yesno" ? v.available ?? (fillDefaults ? "No" : null) : null,
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
      const result = await saveChecklistDraftAction({ id, items: names.map((n) => toInput(n, valuesRef.current[n] || {}, false)), ...meta });
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

  const scheduleSave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
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

  const setVal = (name: string, patch: Partial<ItemValue>) => {
    if (locked) return;
    setValues((v) => ({ ...v, [name]: { ...v[name], ...patch } }));
    dirtyItems.current.add(name);
    scheduleSave();
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

  const flaggedCount = Object.values(values).filter((v) => v.condition === "Damaged" || v.condition === "Missing").length;
  const answeredCount = Object.keys(values).filter((k) => values[k].condition || values[k].available).length;
  const overridingDespiteIssues = ready === true && flaggedCount > 0;
  const totalItems = DD_ALL_ITEMS.length;

  const handleSubmit = () => {
    if (ready === null || locked) return;
    const overallReady = ready;
    setError(null);
    const items = DD_ALL_ITEMS.map((it) => toInput(it.name, values[it.name] || {}, true));
    startTransition(async () => {
      try {
        await flush();
        const result = await submitChecklistAction({ id, type, items, overallReady });
        handleResult(result);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const stop = () => {
    startTransition(async () => {
      try {
        await discardChecklistAction(id);
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

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="eyebrow">Checklist in progress</div>
          <h2>Apartment {apartment}</h2>
        </div>
        <button type="button" className="btn btn-ghost" onClick={exit} disabled={locked}>
          <LogOut size={14} /> Exit · it&apos;s saved
        </button>
      </div>

      {save.kind === "taken" ? (
        <div className="login-error" style={{ margin: 0, display: "flex", gap: 9, alignItems: "flex-start" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {save.by} has taken over this inspection. Your answers up to now are kept in it.{" "}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push("/checklists")}>Back to checklists</button>
          </span>
        </div>
      ) : save.kind === "gone" ? (
        <div className="login-error" style={{ margin: 0 }}>
          This checklist has already been submitted or stopped.{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(`/checklists/${id}`)}>Open it</button>
        </div>
      ) : null}

      <div className="card">
        <div className="new-header-grid">
          <Field label="Apartment / unit number">
            <input className="input" value={apartment} disabled />
          </Field>
          <Field label="Checklist type">
            <div className="seg">
              {DD_CHECKLIST_TYPES.map((t) => (
                <button key={t.value} type="button" disabled={locked} className={`seg-btn ${type === t.value ? "seg-active" : ""}`} onClick={() => chooseType(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Prepared by">
            <input className="input" value={preparedByName} disabled />
          </Field>
        </div>
        <div className="progress-row mono">
          <span>{answeredCount} / {totalItems} items checked</span>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${(answeredCount / totalItems) * 100}%`, background: flaggedCount > 0 ? "var(--red)" : "var(--teal)" }}
            />
          </div>
          {flaggedCount > 0 ? <span className="progress-flag">{flaggedCount} flagged</span> : null}
        </div>
        <div className={`save-note save-${save.kind}`} role="status" aria-live="polite">
          {save.kind === "offline" ? (
            <><CloudOff size={14} /> Not saved — no connection. Keep this page open; it will keep trying.</>
          ) : save.kind === "saving" ? (
            <>Saving…</>
          ) : save.kind === "saved" ? (
            <><CheckCircle2 size={14} /> Saved {fmtClock(save.at)} · the other officers can see you&apos;re inspecting this apartment</>
          ) : null}
        </div>
        <div className="cell-sub" style={{ maxWidth: "none" }}>
          Started {fmtClock(startedAt)}
          {takenOverFrom ? ` · taken over from ${takenOverFrom.name} at ${fmtClock(takenOverFrom.at)}` : ""}
        </div>
      </div>

      {DD_CATEGORIES.map((cat) => (
        <div className="card" key={cat.key}>
          <div className="card-head"><span>{cat.label}</span></div>
          <div className="checklist-grid">
            {cat.items.map((name) => {
              const item = DD_ALL_ITEMS.find((i) => i.name === name)!;
              const v = values[name] || {};
              return (
                <div key={name} className="checklist-row">
                  <span className="checklist-name">{name}</span>
                  <div className="checklist-controls">
                    {item.hasQty ? (
                      <input
                        className="input input-qty"
                        type="number"
                        min="0"
                        placeholder="Qty"
                        value={v.qty || ""}
                        disabled={locked}
                        onChange={(e) => setVal(name, { qty: e.target.value })}
                      />
                    ) : null}
                    {cat.kind === "condition" ? (
                      <div className="seg seg-tight">
                        {DD_CONDITIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            disabled={locked}
                            className={`seg-btn seg-xs tone-${c === "Good" ? "teal" : c === "Damaged" || c === "Missing" ? "red" : "neutral"} ${v.condition === c ? "seg-active" : ""}`}
                            onClick={() => setVal(name, { condition: c })}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="seg seg-tight">
                        {(["Yes", "No"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            disabled={locked}
                            className={`seg-btn seg-xs ${v.available === c ? "seg-active" : ""}`}
                            onClick={() => setVal(name, { available: c })}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card-head"><span>Final status</span></div>
        <p className="gate-copy" style={{ marginTop: -8 }}>
          {flaggedCount > 0
            ? `${flaggedCount} item(s) flagged Damaged/Missing will open maintenance tickets automatically, whichever you choose below.`
            : "No issues flagged."}{" "}
          You decide whether the apartment is ready; the system never picks for you.
        </p>
        <div className="seg">
          {([["Ready", true], ["Not Ready", false]] as const).map(([label, value]) => (
            <button
              key={label}
              type="button"
              disabled={locked}
              className={`seg-btn tone-${value ? "teal" : "red"} ${ready === value ? "seg-active" : ""}`}
              onClick={() => chooseReady(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {overridingDespiteIssues ? (
          <div className="login-error" style={{ marginTop: 14, marginBottom: 0, display: "flex", gap: 9, alignItems: "flex-start" }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              You&apos;re marking this apartment Ready even though {flaggedCount} item(s) are flagged Damaged/Missing. This will still be
              recorded under your name and a maintenance ticket will still be created — but check-in will proceed.
            </span>
          </div>
        ) : null}
      </div>

      <div className="card stop-card">
        {confirmStop ? (
          <div className="lock-confirm">
            <span>Stop this checklist without submitting it? The apartment goes back to its last submitted status, and a record is kept that you stopped it.</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={stop} style={{ color: "var(--red)" }}>
                <Trash2 size={14} /> Yes, stop it
              </button>
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setConfirmStop(false)}>Keep going</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" disabled={locked} onClick={() => setConfirmStop(true)}>
            <Trash2 size={13} /> Stop this checklist without submitting
          </button>
        )}
      </div>

      <div className="submit-bar" style={error ? { flexDirection: "column", alignItems: "stretch" } : undefined}>
        {error ? <div className="login-error" style={{ margin: 0 }}>{error}</div> : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div className="mono submit-summary">
            {ready === null ? "Choose Ready or Not Ready to submit" : <>Submitting as: <strong>{ready ? "Ready" : "Not Ready"}</strong></>}
          </div>
          <button type="button" className="btn btn-primary" disabled={ready === null || pending || locked} onClick={handleSubmit}>
            {pending ? "Submitting…" : "Submit checklist & lock"}
          </button>
        </div>
      </div>
    </div>
  );
}
