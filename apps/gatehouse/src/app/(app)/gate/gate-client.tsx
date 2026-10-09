"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, Car, Check, Download, Keyboard, Settings2 } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Drawer } from "@/components/drawer";
import { Badge } from "@/components/suite";
import type { VehicleLog } from "@/lib/data/vehicles";
import { OVERDUE_MINUTES, cardNo } from "@/lib/types";
import { fmtDur, pl } from "@/lib/gate";
import { errorMessage, isRedirectError } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { logEntryAction, logExitAction, setRackSizeAction, voidVehicleAction } from "./actions";

type Filter = "all" | "on" | "over" | "free";
type Period = "day" | "week";
const TZ = "Africa/Lagos";
const hm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const whenShort = (iso: string, now: number) => (dayKey(iso) === dayKey(new Date(now).toISOString()) ? hm(iso) : `${new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short" })} ${hm(iso)}`);

export function GateClient({
  out, recent, rackSize, now, initialCard, canEdit, canVoid, isAdmin,
}: {
  out: VehicleLog[]; recent: VehicleLog[]; rackSize: number; now: number; initialCard: string | null; canEdit: boolean; canVoid: boolean; isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [inp, setInp] = useState({ card: "", plate: "", driver: "" });
  const [exitCard, setExitCard] = useState("");
  const [inErr, setInErr] = useState<string | null>(null);
  const [exitMsg, setExitMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string | null>(initialCard ? cardNo(initialCard) : null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const [voiding, setVoiding] = useState<VehicleLog | null>(null);
  const [reason, setReason] = useState("");
  const [voidErr, setVoidErr] = useState<string | null>(null);
  const [sizing, setSizing] = useState(false);
  const [size, setSize] = useState(String(rackSize));
  const [sizeErr, setSizeErr] = useState<string | null>(null);
  const cardRef = useRef<HTMLInputElement>(null), plateRef = useRef<HTMLInputElement>(null), exitRef = useRef<HTMLInputElement>(null);

  const mins = (iso: string) => Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  const byCard = useMemo(() => new Map(out.map((v) => [v.card, v])), [out]);
  const over = out.filter((v) => mins(v.entry_at) >= OVERDUE_MINUTES);
  // Cards 001 to the rack size, plus any card that's out with a number outside it.
  const numbers = Array.from({ length: rackSize }, (_, i) => cardNo(i + 1));
  const extra = out.map((v) => v.card).filter((c) => !numbers.includes(c));
  const slots = [...numbers, ...extra];
  const free = Math.max(0, rackSize - out.filter((v) => numbers.includes(v.card)).length);
  const sv = sel ? byCard.get(sel) ?? null : null;

  useEffect(() => {
    const url = new URL(window.location.href);
    if (sel && byCard.has(sel)) url.searchParams.set("card", sel); else url.searchParams.delete("card");
    window.history.replaceState(null, "", url.toString());
  }, [sel, byCard]);
  useEffect(() => { if (!fresh) return; const t = setTimeout(() => setFresh(null), 1500); return () => clearTimeout(t); }, [fresh]);

  const run = (fn: () => Promise<void>, onErr: (m: string) => void) =>
    start(async () => {
      try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; onErr(errorMessage(e)); }
    });

  const logIn = () => {
    setInErr(null);
    run(async () => {
      const r = await callAction(logEntryAction)(inp);
      setInp({ card: "", plate: "", driver: "" });
      setFresh(r.card);
      setSel(r.card);
      cardRef.current?.focus();
    }, (m) => { setInErr(m); });
  };
  const logOut = (card: string) => {
    setExitMsg(null);
    run(async () => {
      const r = await callAction(logExitAction)(card);
      setExitCard("");
      setSel(null);
      setExitMsg({ ok: true, text: `Card ${r.card} back · ${r.plate} has left.` });
    }, (m) => setExitMsg({ ok: false, text: m }));
  };

  const pickSlot = (c: string) => {
    if (byCard.has(c)) { setSel(sel === c ? null : c); return; }
    setSel(null);
    if (!canEdit) return;
    setInp((p) => ({ ...p, card: c }));
    plateRef.current?.focus();
  };

  const periodFrom = now - (period === "day" ? 24 : 7 * 24) * 3600_000;
  const log = recent.filter((v) => new Date(v.entry_at).getTime() >= periodFrom || (v.exit_at && new Date(v.exit_at).getTime() >= periodFrom));
  const statusOf = (v: VehicleLog): [string, "ok" | "bad" | "warn" | "neu"] =>
    v.void ? ["Voided", "neu"] : v.status === "Returned" ? ["Returned", "ok"] : mins(v.entry_at) >= OVERDUE_MINUTES ? ["Overdue", "bad"] : ["On property", "warn"];

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Gate Console</h1><p>Card first, then plate, then Enter. The rack shows every card that’s out.</p></div>
        <div className="acts">
          <span className="hint" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Keyboard size={15} /> <span className="kbd">Tab</span> next field · <span className="kbd">Enter</span> log · <span className="kbd">Esc</span> clear</span>
          <AutoRefresh />
        </div>
      </div>

      <div className="gate-grid">
        <div className="vstack" style={{ gap: 18 }}>
          {canEdit ? (
            <form className="card" noValidate onSubmit={(e) => { e.preventDefault(); logIn(); }} onKeyDown={(e) => { if (e.key === "Escape") { setInp({ card: "", plate: "", driver: "" }); setInErr(null); cardRef.current?.focus(); } }}>
              <div className="card-h"><h3>Log a vehicle in</h3><span className="sp" /><Badge tone="ok" dot={false}>{pl(free, "card")} free</Badge></div>
              <div className="card-b vstack" style={{ gap: 14 }}>
                <div className="field"><label htmlFor="veh-card">Card number</label><input ref={cardRef} className="input big-in" id="veh-card" inputMode="numeric" placeholder="012" autoComplete="off" value={inp.card} onChange={(e) => setInp({ ...inp, card: e.target.value })} autoFocus /></div>
                <div className="field"><label htmlFor="veh-plate">Plate number</label><input ref={plateRef} className="input big-in" id="veh-plate" placeholder="ABC-123-XY" autoComplete="off" value={inp.plate} onChange={(e) => setInp({ ...inp, plate: e.target.value.toUpperCase() })} /></div>
                <div className="field"><label htmlFor="veh-drv">Driver or purpose <span className="muted">(optional)</span></label><input className="input" id="veh-drv" placeholder="Visitor for Jabalia, delivery, contractor…" value={inp.driver} onChange={(e) => setInp({ ...inp, driver: e.target.value })} /></div>
                {inErr ? <div className="err-note" role="alert">{inErr}</div> : null}
                <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={pending}><ArrowRight size={16} /> {pending ? "Saving…" : "Log entry"}</button>
              </div>
            </form>
          ) : null}
          {canEdit ? (
            <form className="card" noValidate onSubmit={(e) => { e.preventDefault(); logOut(exitCard); }} onKeyDown={(e) => { if (e.key === "Escape") { setExitCard(""); setExitMsg(null); } }}>
              <div className="card-h"><h3>Log a vehicle out</h3></div>
              <div className="card-b vstack" style={{ gap: 12 }}>
                <div className="field"><label htmlFor="exit-card">Card handed back</label><input ref={exitRef} className="input big-in" id="exit-card" inputMode="numeric" placeholder="031" autoComplete="off" value={exitCard} onChange={(e) => setExitCard(e.target.value)} /></div>
                {exitMsg ? <div className={exitMsg.ok ? "ok-note" : "err-note"} role={exitMsg.ok ? "status" : "alert"}>{exitMsg.text}</div> : null}
                <button className="btn btn-secondary btn-block" type="submit" disabled={pending}><Check size={15} /> Log exit</button>
              </div>
            </form>
          ) : (
            <div className="card card-b"><p className="muted" style={{ margin: 0 }}>View only. Security officers, the Supervisor and the Admin log vehicles in and out.</p></div>
          )}
        </div>

        <section className="card">
          <div className="card-h">
            <h3>Card rack</h3><span className="sub">{out.length} out · {over.length} overdue · {free} free</span><span className="sp" />
            <div className="seg" role="group" aria-label="Show">{([["all", "All"], ["on", "On property"], ["over", "Overdue"], ["free", "Free"]] as [Filter, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
          </div>
          {sv ? (
            <div className="hstack" style={{ padding: "12px 20px", borderBottom: "1px solid var(--line-soft)", background: "var(--subtle)" }}>
              <b className="mono" style={{ fontSize: 15 }}>Card {sv.card}</b><span className="mono">{sv.plate}</span>
              <span className="muted">{sv.driver || "No driver noted"} · in at {hm(sv.entry_at)} · on property {fmtDur(mins(sv.entry_at))}{sv.logged_by_name ? ` · logged by ${sv.logged_by_name}` : ""}</span>
              <span style={{ flex: 1 }} />
              {canVoid ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setReason(""); setVoidErr(null); setVoiding(sv); }}><Ban size={14} /> Void entry</button> : null}
              {canEdit ? <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => logOut(sv.card)}><Check size={14} /> Log exit</button> : null}
            </div>
          ) : null}
          <div className="rack">
            {slots.map((c) => {
              const v = byCard.get(c), cls = v ? (mins(v.entry_at) >= OVERDUE_MINUTES ? "over" : "on") : "free";
              const dim = filter !== "all" && !(filter === cls || (filter === "on" && cls === "over"));
              return (
                <button key={c} type="button" className={`slot ${cls === "free" ? "" : cls} ${dim ? "dim" : ""} ${sel === c ? "sel" : ""} ${fresh === c ? "fresh" : ""}`} onClick={() => pickSlot(c)} aria-label={`Card ${c} ${v ? v.plate : "free"}`}>
                  <span className="c">{c}{v ? <Car size={12} /> : null}</span>
                  {v ? <><span className="p">{v.plate}</span><span className="du">{fmtDur(mins(v.entry_at))}</span></> : <span className="p" style={{ color: "var(--text-4)" }}>free</span>}
                </button>
              );
            })}
          </div>
          <div className="hstack" style={{ padding: "0 20px 16px", justifyContent: "space-between" }}>
            <div className="legend"><span><i style={{ background: "var(--warn)" }} />On property</span><span><i style={{ background: "var(--bad)" }} />Over 12 hours</span><span><i style={{ border: "1px solid var(--line-strong)" }} />Free</span></div>
            {isAdmin ? (
              sizing ? (
                <span className="hstack">
                  <label htmlFor="rack-size" className="hint">Cards in the rack</label>
                  <input id="rack-size" className="input mono" style={{ width: 80, height: 32 }} inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value)} />
                  <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => { setSizeErr(null); run(async () => { await callAction(setRackSizeAction)(Number(size)); setSizing(false); }, setSizeErr); }}>Save</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSizing(false); setSize(String(rackSize)); setSizeErr(null); }}>Cancel</button>
                  {sizeErr ? <span className="err-note" role="alert">{sizeErr}</span> : null}
                </span>
              ) : <button type="button" className="link" onClick={() => setSizing(true)}><Settings2 size={13} /> {rackSize} cards · change</button>
            ) : <span className="hint">{rackSize} cards</span>}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-h">
          <h3>Vehicle log</h3><span className="sub">{pl(log.length, "entry", "entries")}</span><span className="sp" />
          <div className="seg" role="group" aria-label="Period">{([["day", "Last 24 hours"], ["week", "Last 7 days"]] as [Period, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}</div>
          <a className="btn btn-secondary btn-sm" href={`/gate/export?days=${period === "day" ? 1 : 7}`}><Download size={14} /> Export CSV</a>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Card</th><th>Plate</th><th>Driver / purpose</th><th>In</th><th>Out</th><th>Status</th><th>Logged by</th>{canVoid ? <th /> : null}</tr></thead>
            <tbody>
              {log.map((v) => {
                const [st, tone] = statusOf(v);
                return (
                  <tr key={v.id} style={v.void ? { opacity: 0.55 } : undefined}>
                    <td className="mono">{v.card}</td>
                    <td className="mono">{v.plate}</td>
                    <td>{v.driver ?? "—"}</td>
                    <td className="mono">{whenShort(v.entry_at, now)}</td>
                    <td className="mono">{v.exit_at ? whenShort(v.exit_at, now) : "—"}</td>
                    <td><Badge tone={tone} dot={st !== "Returned"}>{st}</Badge>{v.void && v.void_reason ? <span className="hint"> {v.void_reason}{v.voided_by_name ? ` · ${v.voided_by_name}` : ""}</span> : null}</td>
                    <td className="muted">{v.logged_by_name ?? "—"}{v.exit_by_name ? ` · out: ${v.exit_by_name}` : ""}</td>
                    {canVoid ? <td className="r">{!v.void ? <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Void entry for ${v.plate}`} title="Void" onClick={() => { setReason(""); setVoidErr(null); setVoiding(v); }}><Ban size={13} /></button> : null}</td> : null}
                  </tr>
                );
              })}
              {log.length === 0 ? <tr><td colSpan={canVoid ? 8 : 7} className="empty">No vehicles logged in this period.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <Drawer
        open={!!voiding}
        onClose={() => setVoiding(null)}
        over="Gate Console"
        title={voiding ? `Void entry · card ${voiding.card}` : ""}
        sub={voiding ? `${voiding.plate} · in at ${hm(voiding.entry_at)}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoiding(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!reason.trim() || pending} onClick={() => voiding && run(async () => { await callAction(voidVehicleAction)(voiding.id, reason); setVoiding(null); setSel(null); }, setVoidErr)}>{pending ? "Voiding…" : "Void entry"}</button></>}
      >
        <p className="muted" style={{ margin: 0 }}>For mistakes, like a wrong card or plate. The entry stays on record, marked voided with your reason, and the card shows as free again.</p>
        <div className="field"><label htmlFor="v-reason">Reason (required)</label><textarea className="input" id="v-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong card number, re-logged as 032" /></div>
        {voidErr ? <div className="err-note" role="alert">{voidErr}</div> : null}
      </Drawer>
    </>
  );
}
