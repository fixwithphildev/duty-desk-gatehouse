"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, KeyRound, LogOut, MessageSquare, Pencil, Search } from "lucide-react";
import { Field } from "@/components/ui";
import { Drawer } from "@/components/drawer";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/suite";
import { CheckInDrawer, CheckOutDrawer, type AptOption } from "@/components/stay-drawers";
import { naira, damageTotal } from "@/lib/money";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import type { ResidentRow } from "@/lib/data/residents";
import { updateStayAction, voidResidentAction } from "./actions";

export interface ResidentView extends ResidentRow {
  apartment: string;
  where: string;
  // in: staying now · out: checked out · record: a profile added before stays were recorded
  state: "in" | "out" | "record" | "void";
  leavesToday: boolean;
  arrivedText: string | null;
  leavesText: string | null;
  chargedText: string | null;
  complaints: { id: string; category: string; status: string; description: string }[];
}

type Tab = "in" | "leaving" | "out" | "all";

export function ResidentsClient({ residents, readyApts, initialId, canEdit, canVoid }: { residents: ResidentView[]; readyApts: AptOption[]; initialId: string | null; canEdit: boolean; canVoid: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("in");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(initialId);
  const [checkIn, setCheckIn] = useState(false);
  const [checkOut, setCheckOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ leaves: "", contact: "", preferences: "", notes: "" });
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const detailRef = useRef<HTMLElement>(null);

  const inTab = (r: ResidentView, t: Tab) => t === "all" || (t === "in" ? r.state === "in" : t === "leaving" ? r.leavesToday : r.state === "out");
  const s = q.trim().toLowerCase();
  const list = residents.filter((r) => inTab(r, tab) && (!s || `${r.name} ${r.apartment} ${r.preferences ?? ""} ${r.contact_info ?? ""}`.toLowerCase().includes(s)));
  const sel = residents.find((r) => r.id === selId) ?? list[0] ?? null;

  useEffect(() => {
    if (initialId) { const r = residents.find((x) => x.id === initialId); if (r && !inTab(r, "in")) setTab("all"); }
  }, [initialId]);
  useEffect(() => { setError(null); }, [sel?.id]);

  const pick = (id: string) => {
    setSelId(id);
    if (window.matchMedia("(max-width: 900px)").matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); }
    });
  };

  const n = (t: Tab) => residents.filter((r) => inTab(r, t)).length;
  const stateBadge = (r: ResidentView) =>
    r.state === "void" ? <Badge tone="neu" dot={false}>Voided</Badge>
      : r.state === "out" ? <Badge tone="neu" dot={false}>Checked out</Badge>
        : r.state === "record" ? <Badge tone="neu" dot={false}>Profile</Badge>
          : r.leavesToday ? <Badge tone="warn">Leaves today</Badge> : <Badge tone="ok">In house</Badge>;

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Residents</h1><p>Everyone staying now, with their apartment, dates and preferences. Recording a check-in adds the guest here; recording a check-out moves them to Checked out.</p></div>
        <div className="acts">
          <AutoRefresh />
          {canEdit ? <button type="button" className="btn btn-primary" onClick={() => setCheckIn(true)}><KeyRound size={15} /> Record check-in</button> : null}
        </div>
      </div>

      <div className="g g-main g-split-b">
        <section className="card">
          <div className="tabs" role="tablist" style={{ paddingTop: 4 }}>
            {([["in", "In house"], ["leaving", "Leaving today"], ["out", "Checked out"], ["all", "All"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{n(k)}</span></button>
            ))}
          </div>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <div className="input-wrap"><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, apartment or preference" style={{ height: 36 }} autoComplete="off" aria-label="Search residents" /></div>
          </div>
          <ul className="list" style={{ maxHeight: 640, overflow: "auto" }}>
            {list.map((r) => (
              <li key={r.id} className="row click" onClick={() => pick(r.id)} style={sel?.id === r.id ? { background: "var(--acc-bg)" } : undefined}>
                <span className={`stripe ${r.state !== "in" ? "s-neu" : r.leavesToday ? "s-warn" : "s-ok"}`} />
                <div className="m">
                  <b>{r.name} · {r.apartment}</b>
                  <span>{r.arrivedText ? `In ${r.arrivedText}` : "Arrival not recorded"}{r.leavesText ? ` → out ${r.leavesText}` : ""}{r.preferences ? ` · ${r.preferences}` : ""}</span>
                </div>
                {r.state === "in" && !r.leavesToday ? null : stateBadge(r)}
              </li>
            ))}
            {list.length === 0 ? <li className="empty" style={{ padding: "24px 16px" }}>{tab === "in" && !s ? "Nobody is checked in right now." : tab === "leaving" && !s ? "Nobody is due to leave today." : "No residents match."}</li> : null}
          </ul>
        </section>

        {sel ? (
          <section className="card" ref={detailRef} style={{ scrollMarginTop: 72 }}>
            <div className="card-h" style={{ alignItems: "flex-start" }}>
              <div className="vstack" style={{ gap: 4, flex: 1 }}>
                <span className="mono muted" style={{ fontSize: 12 }}>{sel.checked_in_by_name ? `Checked in by ${sel.checked_in_by_name}` : "Resident profile"}</span>
                <h3 style={{ fontSize: 18 }}>{sel.name}</h3>
                <div className="hstack">{stateBadge(sel)}</div>
              </div>
              {canEdit && sel.state !== "void" ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEdit({ leaves: sel.check_out ?? "", contact: sel.contact_info ?? "", preferences: sel.preferences ?? "", notes: sel.notes ?? "" }); setError(null); setEditing(true); }}><Pencil size={13} /> Change details</button> : null}
            </div>
            <div className="card-b vstack" style={{ gap: 18 }}>
              <dl className="kv">
                <dt>Apartment</dt><dd>{sel.where ? <><Link className="link" href={`/board?apt=${encodeURIComponent(sel.apartment)}`}>{sel.apartment}</Link> <span className="muted">· {sel.where}</span></> : sel.apartment}</dd>
                <dt>Check-in</dt><dd>{sel.arrivedText ?? "Not recorded"}</dd>
                <dt>Check-out</dt><dd>{sel.checked_out_at ? <>{sel.leavesText}{sel.checked_out_by_name ? <span className="muted"> · recorded by {sel.checked_out_by_name}</span> : null}</> : sel.leavesText ? `${sel.leavesText} (planned)` : "Not set"}</dd>
                <dt>Contact</dt><dd className="mono">{sel.contact_info || "Not given"}</dd>
                <dt>Preferences</dt><dd>{sel.preferences || "None noted"}</dd>
                {sel.notes ? <><dt>Notes</dt><dd style={{ whiteSpace: "pre-line" }}>{sel.notes}</dd></> : null}
                {sel.keys_returned ? <><dt>Keys returned</dt><dd>{sel.keys_returned}</dd></> : null}
                {sel.checkout_notes ? <><dt>At check-out</dt><dd style={{ whiteSpace: "pre-line" }}>{sel.checkout_notes}</dd></> : null}
                {sel.void ? <><dt>Voided</dt><dd>{sel.voided_by_name} · {sel.void_reason}</dd></> : null}
              </dl>

              {sel.damage.length ? (
                <div className="vstack" style={{ gap: 8 }}>
                  <span className="over">Damage to charge</span>
                  <ul className="list" style={{ border: "1px solid var(--line-soft)", borderRadius: 12 }}>
                    {sel.damage.map((d, i) => <li key={i} className="row" style={{ padding: "8px 12px" }}><div className="m"><b style={{ fontWeight: 500 }}>{d.item}</b></div><span className="mono">{naira(d.charge)}</span></li>)}
                    <li className="row" style={{ padding: "8px 12px" }}><div className="m"><b>Total</b></div><span className="mono"><b>{naira(damageTotal(sel.damage))}</b></span></li>
                  </ul>
                  {sel.damage_charged_at ? <span className="hint">Charged by {sel.damage_charged_by_name ?? "front desk"} · {sel.chargedText}</span> : <span className="hint">Waiting for front desk to charge the guest.</span>}
                </div>
              ) : null}

              {sel.complaints.map((c) => (
                <Link key={c.id} href={`/complaints?id=${c.id}`} className="pill-note t-warn" style={{ textDecoration: "none" }}>
                  <MessageSquare size={16} /><span>{c.category} · {c.status === "In Progress" ? "In progress" : c.status}: {c.description}</span>
                </Link>
              ))}

              {error ? <div className="err-note" role="alert">{error}</div> : null}
              {sel.state !== "void" ? (
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  {canVoid ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVoidReason(""); setVoidOpen(true); }}><Ban size={13} /> Void</button> : <span className="hint">Only a manager can void a record.</span>}
                  {sel.state === "in" && canEdit ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setCheckOut(true)}><LogOut size={14} /> Record check-out</button> : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="card empty">{residents.length === 0 ? "No residents yet. Record a check-in to add the first." : list.length ? "Choose a resident to see their stay." : "Nobody here. Past stays are under Checked out and All."}</section>
        )}
      </div>

      <CheckInDrawer open={checkIn} onClose={() => setCheckIn(false)} apartment={null} readyApts={readyApts} onDone={(id) => { setTab("in"); setQ(""); setSelId(id); }} />
      <CheckOutDrawer open={checkOut} onClose={() => setCheckOut(false)} stay={sel && sel.state === "in" ? { id: sel.id, guest: sel.name, apartment: sel.apartment, where: sel.where } : null} onDone={() => setTab("out")} />

      <Drawer
        open={editing && !!sel}
        onClose={() => setEditing(false)}
        over="Residents"
        title="Change details"
        sub={sel ? `${sel.name} · ${sel.apartment}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={() => sel && run(async () => { await callAction(updateStayAction)({ id: sel.id, ...edit }); setEditing(false); })}>{pending ? "Saving…" : "Save"}</button></>}
      >
        {sel && !sel.checked_out_at ? <div className="field"><label htmlFor="rs-out">Leaves <span className="muted">(date)</span></label><input className="input mono" id="rs-out" type="date" value={edit.leaves} onChange={(e) => setEdit({ ...edit, leaves: e.target.value })} style={{ maxWidth: 200 }} /></div> : null}
        <Field label="Contact"><input className="input" value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} placeholder="Phone or email" /></Field>
        <Field label="Preferences"><textarea className="input" rows={2} value={edit.preferences} onChange={(e) => setEdit({ ...edit, preferences: e.target.value })} /></Field>
        <Field label="Notes"><textarea className="input" rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <Drawer
        open={voidOpen && !!sel}
        onClose={() => setVoidOpen(false)}
        over="Residents"
        title="Void this record"
        sub={sel ? `${sel.name} · ${sel.apartment}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoidOpen(false)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!voidReason.trim() || pending} onClick={() => sel && run(async () => { await callAction(voidResidentAction)(sel.id, voidReason); setVoidOpen(false); })}>{pending ? "Voiding…" : "Void record"}</button></>}
      >
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>The record stays visible, marked voided with your reason. If the guest is checked in, the apartment stops showing as Occupied.</p>
        <Field label="Reason (required)"><textarea className="input" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Checked in to the wrong apartment" /></Field>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>
    </>
  );
}
