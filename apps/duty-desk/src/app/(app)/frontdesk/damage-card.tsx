"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Receipt } from "lucide-react";
import { naira } from "@/lib/money";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { markDamageChargedAction } from "../residents/actions";

export interface DamageBill {
  id: string;
  guest: string;
  apartment: string;
  left: string;
  by: string | null;
  items: { item: string; charge: number }[];
  total: number;
}

// Damage found when a guest checked out, for front desk to charge and then tick off.
export function DamageCard({ bills, canCharge }: { bills: DamageBill[]; canCharge: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  if (!bills.length) return null;

  const charged = (id: string) => {
    setBusy(id);
    setError(null);
    startTransition(async () => {
      try { await callAction(markDamageChargedAction)(id); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); } finally { setBusy(null); }
    });
  };

  return (
    <section className="card">
      <div className="card-h"><Receipt size={16} /><h3>Damage to charge</h3><span className="sp" /><span className="badge t-warn"><span className="d" />{bills.length} guest{bills.length > 1 ? "s" : ""}</span></div>
      {error ? <div className="err-note" role="alert" style={{ margin: "12px 16px 0" }}>{error}</div> : null}
      <ul className="list">
        {bills.map((b) => (
          <li key={b.id} className="row" style={{ alignItems: "flex-start" }}>
            <span className="stripe s-warn" />
            <div className="m">
              <b>{b.guest} · {b.apartment}</b>
              <span>Checked out {b.left}{b.by ? ` · recorded by ${b.by}` : ""}</span>
              <span style={{ display: "block", marginTop: 4, color: "var(--text-2)", fontSize: 13 }}>{b.items.map((i) => `${i.item} (${naira(i.charge)})`).join(" · ")}</span>
            </div>
            <div className="vstack" style={{ alignItems: "flex-end", gap: 6 }}>
              <span className="mono" style={{ fontWeight: 600 }}>{naira(b.total)}</span>
              {canCharge ? <button type="button" className="btn btn-secondary btn-sm" disabled={busy === b.id} onClick={() => charged(b.id)}><Check size={13} /> {busy === b.id ? "Saving…" : "Charged"}</button> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
