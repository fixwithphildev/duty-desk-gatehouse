"use client";

import { useState, useTransition } from "react";
import { Plus, DoorOpen } from "lucide-react";
import { Badge, Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { statusTone } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { logVehicleEntryAction, returnVehicleCardAction } from "./actions";
import type { VehicleLogRow } from "@/lib/data/vehicles";

function fmtTime(iso: string | null): string {
  return !iso ? "—" : new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EMPTY = { cardNumber: "", plateNumber: "", driverName: "" };

export function VehiclesClient({ logs, canEdit }: { logs: VehicleLogRow[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onProperty = logs.filter((v) => v.status === "In");
  const history = logs.filter((v) => v.status !== "In");

  const submit = () => {
    if (!form.cardNumber.trim() || !form.plateNumber.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await logVehicleEntryAction(form);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const returnCard = (id: string) => startTransition(async () => { await returnVehicleCardAction(id); });

  return (
    <div className="view">
      <div className="view-head">
        <h2>Vehicle Access Log</h2>
        {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Issue card / log entry</button> : null}
      </div>

      <div className="card">
        <div className="card-head"><span>On property ({onProperty.length})</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Card #</th><th>Plate #</th><th>Driver</th><th>Entered</th><th /></tr></thead>
            <tbody>
              {onProperty.map((v) => (
                <tr key={v.id}>
                  <td className="cell-title mono">{v.card_number}</td>
                  <td className="mono">{v.plate_number}</td>
                  <td>{v.driver_name || "—"}</td>
                  <td className="mono">{fmtTime(v.entry_at)}</td>
                  <td>{canEdit ? <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => returnCard(v.id)}><DoorOpen size={13} /> Card returned</button> : null}</td>
                </tr>
              ))}
              {onProperty.length === 0 ? <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>No vehicles currently on property.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>History</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Card #</th><th>Plate #</th><th>Driver</th><th>Entered</th><th>Exited</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((v) => (
                <tr key={v.id}>
                  <td className="cell-title mono">{v.card_number}</td>
                  <td className="mono">{v.plate_number}</td>
                  <td>{v.driver_name || "—"}</td>
                  <td className="mono">{fmtTime(v.entry_at)}</td>
                  <td className="mono">{fmtTime(v.exit_at)}</td>
                  <td><Badge tone={statusTone(v.status)}>{v.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Issue a vehicle card">
        {error ? <div className="login-error">{error}</div> : null}
        <Field label="Card number"><input className="input" value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} placeholder="e.g. C-021" /></Field>
        <Field label="Plate number"><input className="input" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} placeholder="e.g. ABC-123-XY" /></Field>
        <Field label="Driver / company"><input className="input" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} placeholder="Optional" /></Field>
        <button type="button" className="btn btn-primary drawer-submit" disabled={!form.cardNumber.trim() || !form.plateNumber.trim() || pending} onClick={submit}>
          {pending ? "Logging…" : "Log entry & issue card"}
        </button>
      </Drawer>
    </div>
  );
}
