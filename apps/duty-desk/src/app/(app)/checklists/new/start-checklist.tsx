"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Field } from "@/components/ui";
import { DD_CHECKLIST_TYPES } from "@/lib/checklist-data";
import type { ChecklistType } from "@/lib/types";
import type { InProgressChecklist } from "@/lib/data/checklists";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { startChecklistAction } from "./actions";
import { InspectionLock } from "../inspection-lock";

// Step one of a checklist: pick the apartment and the type. Starting it
// creates the in-progress checklist straight away, so everyone can see the
// apartment is being inspected — or, if someone else already is, says who.
export function StartChecklist({ preparedByName, initialApartment }: { preparedByName: string; initialApartment: string }) {
  const router = useRouter();
  const [apartment, setApartment] = useState(initialApartment);
  const [type, setType] = useState<ChecklistType>("check_in_prep");
  const [taken, setTaken] = useState<InProgressChecklist | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    if (!apartment.trim()) return;
    setError(null);
    setTaken(null);
    startTransition(async () => {
      try {
        const result = await startChecklistAction({ apartment, type });
        if (result.ok) router.push(`/checklists/${result.id}`);
        else setTaken(result.taken);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <div className="view">
      <div className="view-head">
        <h2>New Checklist</h2>
        <button type="button" className="btn btn-ghost" onClick={() => router.push("/checklists")}>
          <X size={14} /> Cancel
        </button>
      </div>

      <div className="card">
        <div className="new-header-grid">
          <Field label="Apartment / unit number">
            <input
              className="input"
              value={apartment}
              onChange={(e) => {
                setApartment(e.target.value);
                setTaken(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") start();
              }}
              placeholder="e.g. 12B"
              autoFocus
            />
          </Field>
          <Field label="Checklist type">
            <div className="seg">
              {DD_CHECKLIST_TYPES.map((t) => (
                <button key={t.value} type="button" className={`seg-btn ${type === t.value ? "seg-active" : ""}`} onClick={() => setType(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Prepared by">
            <input className="input" value={preparedByName} disabled />
          </Field>
        </div>
        <p className="gate-copy" style={{ marginBottom: 0 }}>
          Every answer is saved as you go, so the other officers can see you&apos;re inspecting this apartment, and nothing is lost if your phone dies.
        </p>
        {error ? <div className="login-error" style={{ marginTop: 14, marginBottom: 0 }}>{error}</div> : null}
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" disabled={!apartment.trim() || pending} onClick={start}>
            {pending ? "Starting…" : "Start checklist"}
          </button>
        </div>
      </div>

      {taken ? <InspectionLock draft={taken} canTakeOver /> : null}
    </div>
  );
}
