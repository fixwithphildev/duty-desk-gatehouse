"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, KeyRound, LogOut, Plus, Trash2, Users, Wrench } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Field } from "@/components/ui";
import { DD_MAX_MAINTENANCE_REASONS, DD_PRIORITIES, DD_TICKET_DEPTS } from "@/lib/checklist-data";
import { naira, damageTotal } from "@/lib/money";
import { shrinkPhoto } from "@/lib/photo";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { checkInAction, checkOutAction } from "@/app/(app)/residents/actions";
import { putUnderMaintenanceAction } from "@/app/(app)/maintenance/actions";

// "2026-10-08T10:15" in the browser's own time, for datetime-local inputs.
const localInput = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const localDate = (d = new Date()) => localInput(d).slice(0, 10);

export interface AptOption {
  name: string;
  where: string;
}

// Record check-in. With an apartment given (from the board), it's fixed; otherwise pick one of the
// apartments that are Ready to sell.
export function CheckInDrawer({ open, onClose, apartment, readyApts, onDone }: { open: boolean; onClose: () => void; apartment: AptOption | null; readyApts: AptOption[]; onDone?: (id: string) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [guest, setGuest] = useState("");
  const [arrived, setArrived] = useState(localInput());
  const [leaves, setLeaves] = useState("");
  const [contact, setContact] = useState("");
  const [prefs, setPrefs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setQ(""); setGuest(""); setArrived(localInput()); setLeaves(""); setContact(""); setPrefs(""); setError(null);
  }, [open]);

  const typed = q.trim().toLowerCase();
  const picked = apartment ?? readyApts.find((a) => a.name.toLowerCase() === typed) ?? null;
  const sugg = !apartment && typed && !picked ? readyApts.filter((a) => a.name.toLowerCase().includes(typed)).slice(0, 6) : [];

  const submit = () => {
    if (!picked) return setError(readyApts.length ? "Choose an apartment that’s Ready to sell from the list." : "No apartment is Ready to sell right now.");
    if (!guest.trim()) return setError("Give the guest’s name.");
    if (!arrived) return setError("Give the time the guest arrived.");
    setError(null);
    startTransition(async () => {
      try {
        const r = await callAction(checkInAction)({ apartment: picked.name, guest, arrivedAt: new Date(arrived).toISOString(), leaves, contact, preferences: prefs });
        onClose();
        onDone?.(r.id);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      over="Record check-in"
      title={apartment ? apartment.name : "New check-in"}
      sub={apartment ? apartment.where : "Only apartments that are Ready to sell can be checked in"}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Check size={15} /> {pending ? "Saving…" : "Record check-in"}</button></>}
    >
      {!apartment ? (
        <div className="field gsearch">
          <label htmlFor="ci-apt">Apartment</label>
          <input className="input" id="ci-apt" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} placeholder={readyApts.length ? "Start typing a green apartment" : "No apartment is ready to sell"} autoComplete="off" />
          {focus && (sugg.length || (!typed && readyApts.length)) ? (
            <div className="sugg" role="listbox">{(sugg.length ? sugg : readyApts.slice(0, 6)).map((a) => <button key={a.name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(a.name); setFocus(false); }}><b>{a.name}</b><span>{a.where}</span></button>)}</div>
          ) : null}
          {picked ? <span className="hint">{picked.where} · Ready to sell</span> : typed && !sugg.length ? <span className="hint" style={{ color: "var(--bad-fg)" }}>“{q.trim()}” isn’t Ready to sell, so it can’t be checked in.</span> : null}
        </div>
      ) : null}
      <Field label="Guest name"><input className="input" value={guest} onChange={(e) => setGuest(e.target.value)} autoComplete="off" /></Field>
      <div className="hstack" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <div className="field" style={{ flex: "1 1 180px" }}><label htmlFor="ci-in">Arrived</label><input className="input mono" id="ci-in" type="datetime-local" value={arrived} max={localInput()} onChange={(e) => setArrived(e.target.value)} /></div>
        <div className="field" style={{ flex: "1 1 150px" }}><label htmlFor="ci-out">Leaves <span className="muted">(date)</span></label><input className="input mono" id="ci-out" type="date" value={leaves} min={localDate()} onChange={(e) => setLeaves(e.target.value)} /></div>
      </div>
      <Field label="Contact (optional)"><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" autoComplete="off" /></Field>
      <Field label="Preferences or notes (optional)"><textarea className="input" rows={2} value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder="Late check-out, extra pillows…" /></Field>
      <div className="pill-note t-info"><Users size={16} /><span>{picked ? picked.name : "The apartment"} turns grey (Occupied), so front desk can’t sell it again. The guest is saved in Residents, and on the day they leave the apartment shows under Check-outs today.</span></div>
      {error ? <div className="err-note" role="alert">{error}</div> : null}
    </Drawer>
  );
}

export interface StayInfo {
  id: string;
  guest: string;
  apartment: string;
  where: string;
}

type DamageRow = { item: string; charge: string };

// Record check-out: time, keys, and any damage for front desk to charge.
export function CheckOutDrawer({ open, onClose, stay, onDone }: { open: boolean; onClose: () => void; stay: StayInfo | null; onDone?: () => void }) {
  const router = useRouter();
  const [left, setLeft] = useState(localInput());
  const [keys, setKeys] = useState("Yes");
  const [found, setFound] = useState(false);
  const [rows, setRows] = useState<DamageRow[]>([{ item: "", charge: "" }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLeft(localInput()); setKeys("Yes"); setFound(false); setRows([{ item: "", charge: "" }]); setNotes(""); setError(null);
  }, [open, stay?.id]);

  const damage = found ? rows.filter((r) => r.item.trim()).map((r) => ({ item: r.item.trim(), charge: Number(r.charge.replace(/[^\d.]/g, "")) || 0 })) : [];
  const setRow = (i: number, patch: Partial<DamageRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    if (!stay) return;
    if (!left) return setError("Give the time the guest left.");
    if (found && !damage.length) return setError("Say what is damaged, or choose “None found”.");
    if (damage.some((d) => !(d.charge > 0))) return setError("Give a charge for each damaged item.");
    if (damage.some((d) => d.charge > 10_000_000)) return setError("One of the charges is over ₦10,000,000. Check the amount.");
    setError(null);
    startTransition(async () => {
      try {
        await callAction(checkOutAction)({ id: stay.id, leftAt: new Date(left).toISOString(), keys, damage, notes });
        onClose();
        onDone?.();
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <Drawer
      open={open && !!stay}
      onClose={onClose}
      over="Record check-out"
      title={stay?.apartment ?? ""}
      sub={stay ? `${stay.guest} · ${stay.where}` : undefined}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><LogOut size={15} /> {pending ? "Saving…" : "Record check-out"}</button></>}
    >
      <div className="field"><label htmlFor="co-time">Guest left at</label><input className="input mono" id="co-time" type="datetime-local" value={left} max={localInput()} onChange={(e) => setLeft(e.target.value)} style={{ maxWidth: 240 }} /></div>
      <div className="field"><span className="flabel"><KeyRound size={13} style={{ verticalAlign: "-2px" }} /> Keys and access cards returned</span><div className="seg" role="group" aria-label="Keys returned">{["Yes", "Partly", "No"].map((k) => <button key={k} type="button" aria-pressed={keys === k} onClick={() => setKeys(k)}>{k}</button>)}</div></div>
      <div className="field"><span className="flabel">Damage to charge the guest</span><div className="seg" role="group" aria-label="Damage">{[["none", "None found"], ["found", "Found damage"]].map(([k, l]) => <button key={k} type="button" aria-pressed={(k === "found") === found} onClick={() => setFound(k === "found")}>{l}</button>)}</div></div>
      {found ? (
        <div className="vstack" style={{ gap: 8, padding: 12, border: "1px dashed var(--line-strong)", borderRadius: 12 }}>
          {rows.map((r, i) => (
            <div key={i} className="hstack" style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 1 }}><label htmlFor={`co-item-${i}`}>What is damaged</label><input className="input" id={`co-item-${i}`} value={r.item} onChange={(e) => setRow(i, { item: e.target.value })} placeholder="e.g. Coffee table glass cracked" /></div>
              <div className="field" style={{ width: 130 }}><label htmlFor={`co-amt-${i}`}>Charge (₦)</label><input className="input mono" id={`co-amt-${i}`} inputMode="numeric" value={r.charge} onChange={(e) => setRow(i, { charge: e.target.value.replace(/[^\d,]/g, "") })} placeholder="35,000" /></div>
              {rows.length > 1 ? <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Remove this item" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button> : null}
            </div>
          ))}
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows([...rows, { item: "", charge: "" }])}><Plus size={14} /> Another item</button>
            {damage.length ? <span className="mono" style={{ fontSize: 13 }}>Total {naira(damageTotal(damage))}</span> : null}
          </div>
        </div>
      ) : null}
      <Field label="Notes (optional)"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the next check-in prep should look at" /></Field>
      <div className="pill-note t-info"><LogOut size={16} /><span>{found ? "The damage goes to front desk for charging. " : ""}{stay?.apartment} then shows as Needs checklist and can’t be sold until a Resident Officer submits a check-in prep as Ready.</span></div>
      {error ? <div className="err-note" role="alert">{error}</div> : null}
    </Drawer>
  );
}

type ReasonRow = { issue: string; dept: string; priority: (typeof DD_PRIORITIES)[number]; notes: string; photo: File | null };
const newReason = (): ReasonRow => ({ issue: "", dept: "General Maintenance", priority: "Medium", notes: "", photo: null });
// The photos all go in one upload, which the server caps at 4 MB.
const MAX_PHOTO_BYTES = 3.5 * 1024 * 1024;

// Put an apartment under maintenance from the board, for one or more reasons. Each reason opens
// a repair ticket for its team, and the apartment can't be sold until they're all fixed and a new
// check-in prep is submitted Ready. "add" is for one already under maintenance; "occupied" for one
// with a guest in it (it goes under maintenance once they leave, if the repairs aren't done).
export function MaintenanceDrawer({ open, onClose, apartment, mode, onDone }: { open: boolean; onClose: () => void; apartment: AptOption | null; mode: "put" | "add" | "occupied"; onDone?: (ids: string[]) => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<ReasonRow[]>([newReason()]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setRows([newReason()]); setError(null); setSaved(null);
  }, [open]);

  const setRow = (i: number, patch: Partial<ReasonRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // Rows left completely empty are ignored; a row with anything in it needs to say what's wrong.
  const filled = rows.filter((r) => r.issue.trim() || r.notes.trim() || r.photo);
  const n = filled.length || 1;
  const apt = apartment?.name ?? "";

  const submit = () => {
    if (!apartment) return;
    if (!filled.length) return setError("Say what’s wrong.");
    const blank = filled.findIndex((r) => !r.issue.trim());
    if (blank >= 0) return setError(filled.length > 1 ? `Say what’s wrong for reason ${blank + 1}.` : "Say what’s wrong.");
    setError(null);
    startTransition(async () => {
      try {
        const photos = await Promise.all(filled.map((r) => (r.photo ? shrinkPhoto(r.photo) : null)));
        if (photos.reduce((s, p) => s + (p?.size ?? 0), 0) > MAX_PHOTO_BYTES) return setError("The photos are too big to send together. Send fewer now and add the rest on the tickets in Maintenance.");
        const fd = new FormData();
        fd.set("apartment", apartment.name);
        fd.set("reasons", JSON.stringify(filled.map((r) => ({ issue: r.issue.trim(), dept: r.dept, priority: r.priority, notes: r.notes.trim() }))));
        photos.forEach((p, i) => { if (p) fd.set(`photo${i}`, p); });
        const r = await callAction(putUnderMaintenanceAction)(fd);
        onDone?.(r.ids);
        router.refresh();
        if (r.photosFailed) return setSaved(`${r.photosFailed === 1 ? "One photo" : `${r.photosFailed} photos`} didn’t upload. Add ${r.photosFailed === 1 ? "it" : "them"} on the ticket in Maintenance.`);
        onClose();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const go = mode === "put" ? "Put under maintenance" : mode === "add" ? (n > 1 ? "Add reasons" : "Add reason") : n > 1 ? "Report problems" : "Report problem";
  return (
    <Drawer
      open={open && !!apartment}
      onClose={onClose}
      over={mode === "put" ? "Put under maintenance" : mode === "add" ? "Under maintenance · add a reason" : "Report a problem"}
      title={apt}
      sub={apartment?.where}
      footer={saved
        ? <button type="button" className="btn btn-primary" onClick={onClose}><Check size={15} /> Close</button>
        : <><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Wrench size={15} /> {pending ? "Sending…" : go}</button></>}
    >
      {saved ? (
        <>
          <div className="pill-note t-ok"><Check size={16} /><span>{mode === "occupied" ? "The problem is reported." : `${apt} is under maintenance.`} Each reason went to its team as a repair ticket.</span></div>
          <div className="err-note" role="alert">{saved}</div>
        </>
      ) : (
        <>
          {rows.map((r, i) => (
            <div key={i} className="reason-form">
              {rows.length > 1 ? (
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  <span className="over">Reason {i + 1}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={14} /> Remove</button>
                </div>
              ) : null}
              <div className="field"><label htmlFor={`um-issue-${i}`}>What’s wrong</label><input className="input" id={`um-issue-${i}`} value={r.issue} onChange={(e) => setRow(i, { issue: e.target.value })} placeholder="e.g. Bathroom tap leaking" autoComplete="off" /></div>
              <div className="field"><span className="flabel">Send to</span><div className="seg" role="group" aria-label={`Send reason ${i + 1} to`} style={{ flexWrap: "wrap" }}>{DD_TICKET_DEPTS.map((d) => <button key={d} type="button" aria-pressed={r.dept === d} onClick={() => setRow(i, { dept: d })}>{d}</button>)}</div></div>
              <div className="field"><span className="flabel">Priority</span><div className="seg" role="group" aria-label={`Priority of reason ${i + 1}`}>{DD_PRIORITIES.map((p) => <button key={p} type="button" aria-pressed={r.priority === p} onClick={() => setRow(i, { priority: p })}>{p}</button>)}</div></div>
              <div className="field"><label htmlFor={`um-notes-${i}`}>Details (optional)</label><textarea className="input" id={`um-notes-${i}`} rows={2} value={r.notes} onChange={(e) => setRow(i, { notes: e.target.value })} placeholder="Where exactly, what you saw" /></div>
              <label className="photo-add" style={{ alignSelf: "flex-start", width: "auto", height: "auto", padding: "8px 12px", flexDirection: "row" }}>
                <Camera size={15} /><span>{r.photo ? r.photo.name : "Add photo"}</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => setRow(i, { photo: e.target.files?.[0] ?? null })} />
              </label>
            </div>
          ))}
          {rows.length < DD_MAX_MAINTENANCE_REASONS ? <button type="button" className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={() => setRows([...rows, newReason()])}><Plus size={15} /> Another reason</button> : null}
          <div className="pill-note t-maint"><Wrench size={16} /><span>{mode === "occupied"
            ? `A guest is staying in ${apt}. The ${n > 1 ? "tickets go to their teams" : "ticket goes to the team"} now. Once the guest leaves, ${apt} stays under maintenance until it’s fixed and checked again.`
            : `${mode === "put" ? `${apt} goes under maintenance straight away, so front desk can’t sell it. ` : ""}Each reason goes to its team as a repair ticket, with your name and the time. When every repair is fixed it shows Repairs done, and a check-in prep submitted Ready makes it sellable again.`}</span></div>
          {error ? <div className="err-note" role="alert">{error}</div> : null}
        </>
      )}
    </Drawer>
  );
}
