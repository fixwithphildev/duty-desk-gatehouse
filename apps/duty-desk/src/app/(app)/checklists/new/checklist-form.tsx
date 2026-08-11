"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Field } from "@/components/ui";
import { DD_ALL_ITEMS, DD_CATEGORIES, DD_CHECKLIST_TYPES, DD_CONDITIONS } from "@/lib/checklist-data";
import type { ChecklistItemInput, ChecklistType, Condition } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { submitChecklistAction } from "./actions";

interface ItemValue {
  qty?: string;
  condition?: Condition;
  available?: "Yes" | "No";
}

export function ChecklistForm({ preparedByName }: { preparedByName: string }) {
  const router = useRouter();
  const [apartment, setApartment] = useState("");
  const [type, setType] = useState<ChecklistType>("check_in_prep");
  const [values, setValues] = useState<Record<string, ItemValue>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const setVal = (name: string, patch: Partial<ItemValue>) =>
    setValues((v) => ({ ...v, [name]: { ...v[name], ...patch } }));

  const flaggedCount = Object.values(values).filter((v) => v.condition === "Damaged" || v.condition === "Missing").length;
  const answeredCount = Object.keys(values).filter((k) => values[k].condition || values[k].available).length;

  const handleSubmit = () => {
    setError(null);
    if (!apartment.trim()) return;
    const items: ChecklistItemInput[] = DD_ALL_ITEMS.map((it) => {
      const v = values[it.name] || {};
      return {
        name: it.name,
        category: it.categoryLabel,
        kind: it.kind,
        qty: it.hasQty ? v.qty ?? "" : null,
        condition: it.kind === "condition" ? v.condition ?? "N/A" : null,
        available: it.kind === "yesno" ? v.available ?? "No" : null,
      };
    });
    startTransition(async () => {
      try {
        await submitChecklistAction({ apartment, type, items });
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const totalItems = DD_ALL_ITEMS.length;

  return (
    <div className="view">
      <div className="view-head">
        <h2>New Checklist</h2>
        <button type="button" className="btn btn-ghost" onClick={() => router.push("/checklists")}>
          <X size={14} /> Cancel
        </button>
      </div>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="card">
        <div className="new-header-grid">
          <Field label="Apartment / unit number">
            <input className="input" value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="e.g. 12B" />
          </Field>
          <Field label="Checklist type">
            <div className="seg">
              {DD_CHECKLIST_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`seg-btn ${type === t.value ? "seg-active" : ""}`}
                  onClick={() => setType(t.value)}
                >
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
                        onChange={(e) => setVal(name, { qty: e.target.value })}
                      />
                    ) : null}
                    {cat.kind === "condition" ? (
                      <div className="seg seg-tight">
                        {DD_CONDITIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
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

      <div className="submit-bar">
        <div className="mono submit-summary">
          {flaggedCount > 0 ? `${flaggedCount} item(s) will open maintenance tickets automatically.` : "No issues flagged — apartment will be marked Ready."}
        </div>
        <button type="button" className="btn btn-primary" disabled={!apartment.trim() || pending} onClick={handleSubmit}>
          {pending ? "Submitting…" : "Submit checklist & lock"}
        </button>
      </div>
    </div>
  );
}
