"use client";

import { useState, useTransition } from "react";
import { Plus, DoorOpen, AlertOctagon } from "lucide-react";
import { Badge, Drawer, Field } from "@/components/ui";
import { statusTone } from "@/lib/types";
import { GH_KEY_TYPES } from "@/lib/constants";
import type { KeyRecordRow } from "@/lib/data/keys";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { issueKeyAction, returnKeyAction, markKeyLostAction } from "./actions";

function fmtTime(iso: string | null): string {
  return !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { keyType: GH_KEY_TYPES[0], area: "", issuedTo: "" };

export function KeysClient({ records, canEdit }: { records: KeyRecordRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!form.area.trim() || !form.issuedTo.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await issueKeyAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const returnKey = (id: string) => startTransition(async () => { await returnKeyAction(id); });
  const markLost = (id: string) => startTransition(async () => { await markKeyLostAction(id); });

  return (
    <div className="view">
      <div className="view-head">
        <h2>Access &amp; Keys</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Issue key</button> : null}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Type</th><th>Area</th><th>Issued to</th><th>Status</th><th /></tr></thead>
          <tbody>
            {records.map((k) => (
              <tr key={k.id}>
                <td>{k.key_type}</td>
                <td>{k.area}</td>
                <td>{k.issued_to}</td>
                <td><Badge tone={statusTone(k.status)}>{k.status}</Badge></td>
                <td>
                  {canEdit && k.status === "Issued" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => returnKey(k.id)}><DoorOpen size={13} /> Return</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => markLost(k.id)}><AlertOctagon size={13} /> Lost</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {records.length === 0 ? <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", opacity: 0.6 }}>No keys issued yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Issue a key">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Key type">
          <select className="select" value={form.keyType} onChange={(e) => setForm({ ...form, keyType: e.target.value })}>
            {GH_KEY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Area"><input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. 3rd floor" /></Field>
        <Field label="Issued to"><input className="input" value={form.issuedTo} onChange={(e) => setForm({ ...form, issuedTo: e.target.value })} placeholder="e.g. Housekeeping Lead" /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.area.trim() || !form.issuedTo.trim() || pending} onClick={submit}>
          {pending ? "Issuing…" : "Issue key"}
        </button>
      </Drawer>
    </div>
  );
}
