"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, Ban, Check, Layers, Plus, Receipt, Search, Wallet, X } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { Field } from "@/components/ui";
import { Badge, Kpi, stTone } from "@/components/suite";
import { stLabel } from "@/lib/jobs";
import { MD_UNITS, UNIT_COLOR, formatNaira as naira } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { addPurchaseAction, voidExpenseAction } from "./actions";
import { markNoPurchaseAction } from "../jobs/actions";

export interface Purchase {
  id: string;
  date: string;
  dateText: string;
  unit: string;
  item: string;
  quantity: number;
  unitCost: number;
  total: number;
  supplier: string | null;
  jobId: string | null;
  jobRef: string | null;
  jobArea: string | null;
  isRequest: boolean;
  recordedBy: string;
}

export interface JobOption {
  id: string;
  ref: string;
  title: string;
  area: string;
  unit: string;
  status: "Reported" | "In Progress" | "Resolved";
  isRequest: boolean;
  requester: string | null;
  spent: number;
  released: number | null;
  need: number | null;
  old: boolean;
}

type Period = "week" | "month" | "all";
const num = (v: string) => parseFloat(v.replace(/[^0-9.]/g, ""));
const lineTotal = (r: { q: string; u: string }) => { const q = num(r.q), u = num(r.u); return q > 0 && u >= 0 ? q * u : 0; };
const blankRow = () => ({ item: "", q: "1", u: "" });
const sum = (list: Purchase[]) => list.reduce((a, p) => a + p.total, 0);
const dot = (u: string) => <i className="dot-u" style={{ background: UNIT_COLOR[u] ?? "var(--neu)" }} />;

export function CostsClient({
  purchases,
  options,
  missing,
  canManage,
  me,
  today,
  week,
  month,
  initialUnit,
  initialJob,
}: {
  purchases: Purchase[];
  options: JobOption[];
  missing: { id: string; ref: string; title: string; area: string; unit: string }[];
  canManage: boolean;
  me: string;
  today: string;
  week: { from: string; to: string };
  month: { from: string; to: string; name: string };
  initialUnit: string;
  initialJob: string;
}) {
  const router = useRouter();
  const [unitView, setUnitView] = useState(initialUnit);
  const [period, setPeriod] = useState<Period>("month");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ unit: initialUnit === "all" ? "" : initialUnit, job: initialJob, supplier: "", date: today, rows: [blankRow()] });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<Purchase | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const inUnit = (p: { unit: string }) => unitView === "all" || p.unit === unitView;
  const inPeriod = (p: Purchase, k: Period) => k === "all" || (k === "week" ? p.date >= week.from && p.date <= week.to : p.date >= month.from && p.date <= month.to);
  const all = purchases.filter(inUnit), wk = all.filter((p) => inPeriod(p, "week")), mo = all.filter((p) => inPeriod(p, "month"));
  const moAll = purchases.filter((p) => inPeriod(p, "month"));
  const jobsMo = new Set(mo.filter((p) => p.jobId).map((p) => p.jobId)).size;
  const miss = missing.filter(inUnit);
  const uName = unitView === "all" ? "all units" : unitView;
  const s = q.trim().toLowerCase();
  const log = all.filter((p) => inPeriod(p, period) && (!s || `${p.item} ${p.supplier ?? ""} ${p.jobRef ?? ""} ${p.jobArea ?? ""} ${p.recordedBy} ${p.unit}`.toLowerCase().includes(s)));
  const sup = new Map<string, number>();
  for (const p of mo) sup.set(p.supplier || "—", (sup.get(p.supplier || "—") ?? 0) + p.total);
  const smax = Math.max(1, ...sup.values());

  const unitJobs = options.filter((o) => (!form.unit || o.unit === form.unit) && (!o.old || o.id === form.job)).sort((a, b) => ["In Progress", "Reported", "Resolved"].indexOf(a.status) - ["In Progress", "Reported", "Resolved"].indexOf(b.status));
  const chosen = options.find((o) => o.id === form.job);
  const total = form.rows.reduce((a, r) => a + lineTotal(r), 0);
  const setRow = (i: number, patch: Partial<{ item: string; q: string; u: string }>) => setForm({ ...form, rows: form.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const pickUnit = (u: string) => {
    setUnitView(u);
    if (u !== "all" && form.unit !== u) setForm({ ...form, unit: u, job: "" });
  };
  const addCostFor = (id: string, unit: string) => {
    setForm({ ...form, unit, job: id, rows: [blankRow()] });
    setSaved(null);
    document.getElementById("cf-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = () => {
    const rows = form.rows.filter((r) => r.item.trim() || r.u);
    if (!form.unit) return setError("Choose your unit.");
    if (!form.job) return setError("Choose the job this was bought for, or stock for the unit.");
    if (!rows.length) return setError("Add at least one item.");
    const bad = rows.findIndex((r) => !r.item.trim() || !(num(r.q) > 0) || !(num(r.u) >= 0));
    if (bad >= 0) return setError(`Line ${form.rows.indexOf(rows[bad]) + 1}: give the item, a quantity above 0 and the unit cost in Naira.`);
    setError(null);
    startTransition(async () => {
      try {
        await addPurchaseAction({ unit: form.unit, jobId: form.job, supplier: form.supplier, date: form.date, lines: rows.map((r) => ({ item: r.item, quantity: num(r.q), unitCost: num(r.u) })) });
        const what = form.job === "STOCK" ? `${form.unit} stock` : chosen?.ref ?? "the job";
        setSaved(`${rows.length} item${rows.length > 1 ? "s" : ""} saved for ${what} · ${naira(total)}`);
        setForm({ unit: form.unit, job: "", supplier: "", date: today, rows: [blankRow()] });
        setPeriod(form.date >= week.from ? "week" : "month");
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const run = (fn: () => Promise<void>, after?: () => void) => {
    startTransition(async () => {
      try { await fn(); after?.(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); }
    });
  };

  const group = (label: string, list: JobOption[]) =>
    list.length ? (
      <optgroup label={label}>
        {list.map((o) => <option key={o.id} value={o.id}>{o.ref} · {o.title} · {o.area}{o.requester ? ` · asked by ${o.requester}` : ""}{o.status === "Resolved" ? " (done)" : ""}</option>)}
      </optgroup>
    ) : null;

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Costs</h1><p>Each unit records what it spent to get a job done: for a request, a Ticket Board job, or stock for the unit. Spending adds it all up by unit, week and month.</p></div>
        <div className="acts"><Link href="/spending" className="btn btn-secondary"><BarChart3 size={15} /> Spending</Link></div>
      </div>

      <div className="vstack" style={{ gap: 8 }}>
        <span className="over">{month.name} by unit · tap a unit to see only its costs</span>
        <div className="u-strip">
          {[["all", "All units", "var(--acc)"], ...MD_UNITS.map((u) => [u, u, UNIT_COLOR[u]])].map(([u, label, color]) => {
            const ps = u === "all" ? moAll : moAll.filter((p) => p.unit === u), v = sum(ps), tot = sum(moAll);
            return (
              <button key={u} type="button" className={`u-card ${unitView === u ? "on" : ""}`} aria-pressed={unitView === u} onClick={() => pickUnit(u)} style={{ ["--uc" as string]: color }}>
                <span className="hstack" style={{ gap: 8, flexWrap: "nowrap" }}><span className="u-ic">{u === "all" ? <Layers size={16} /> : <Receipt size={16} />}</span><span className="u-nm">{label}</span></span>
                <b className="mono">{naira(v)}</b>
                <span className="u-bar"><span style={{ width: `${tot ? (v / tot) * 100 : 0}%` }} /></span>
                <span className="u-sub">{ps.length} item{ps.length === 1 ? "" : "s"} · {tot ? Math.round((v / tot) * 100) : 0}% of {month.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Wallet} label="Spent this week" value={naira(sum(wk))} ctx={`${wk.length} item${wk.length === 1 ? "" : "s"} · ${uName}`} />
        <Kpi icon={Receipt} label={`Spent in ${month.name}`} value={naira(sum(mo))} ctx={`${mo.length} items · ${jobsMo} job${jobsMo === 1 ? "" : "s"}`} />
        <Kpi icon={BarChart3} label="Average per job" value={naira(sum(mo.filter((p) => p.jobId)) / Math.max(1, jobsMo))} ctx={`${month.name}, stock not included`} />
        <Kpi icon={AlertTriangle} label="Resolved, cost not recorded" value={miss.length} ctx={miss.length ? "add what was bought, or mark nothing bought" : "all costs recorded"} tile={miss.length ? "bad" : ""} />
      </div>

      <div className="g g-main g-split-c">
        {canManage ? (
          <section className="card" id="cf-card">
            <div className="card-h"><h3>Record a purchase</h3><span className="sp" /><span className="sub">one receipt, any number of items</span></div>
            <div className="card-b vstack" style={{ gap: 14 }}>
              <div className="hstack cf-meta" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <div className="field" style={{ width: 200 }}>
                  <label htmlFor="cf-unit">Unit</label>
                  <select className="input" id="cf-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value, job: "" })}>
                    <option value="">Choose your unit…</option>
                    {MD_UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="cf-job">What it was for</label>
                  <select className="input" id="cf-job" value={form.job} disabled={!form.unit} onChange={(e) => setForm({ ...form, job: e.target.value })}>
                    {form.unit ? <option value="">Choose what it was for…</option> : <option value="">Choose the unit first</option>}
                    {group("Requests", unitJobs.filter((o) => o.isRequest))}
                    {group("Ticket Board · Duty Desk jobs", unitJobs.filter((o) => !o.isRequest))}
                    {form.unit ? <optgroup label="Unit stock"><option value="STOCK">Stock for {form.unit} (not for one job)</option></optgroup> : null}
                  </select>
                  {chosen ? <span className="hint"><Badge tone={stTone(chosen.status)} dot={false}>{stLabel(chosen.status)}</Badge> {chosen.requester ? `request from ${chosen.requester} · ` : ""}already spent {naira(chosen.spent)}{chosen.need != null ? ` · Finance released ${naira(chosen.released ?? 0)} of ${naira(chosen.need)}` : ""}</span>
                    : form.job === "STOCK" ? <span className="hint">For things the unit keeps in its store, like cable, pipe, paint or welding rods.</span> : null}
                </div>
              </div>
              <div className="hstack cf-meta" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <div className="field" style={{ flex: 1 }}><label htmlFor="cf-sup">Supplier <span className="muted">(optional)</span></label><input className="input" id="cf-sup" list="cf-sups" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. Ikeja market" autoComplete="off" /><datalist id="cf-sups">{[...new Set(purchases.map((p) => p.supplier).filter(Boolean) as string[])].map((s2) => <option key={s2} value={s2} />)}</datalist></div>
                <div className="field" style={{ width: 170 }}><label htmlFor="cf-date">Date bought</label><input className="input mono" id="cf-date" type="date" value={form.date} max={today} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              <div>
                <div className="cf-row cf-head"><span>What was bought</span><span>Qty</span><span>Unit cost (₦)</span><span style={{ textAlign: "right" }}>Line total</span><span /></div>
                {form.rows.map((r, i) => (
                  <div key={i} className="cf-row">
                    <input className="input" value={r.item} onChange={(e) => setRow(i, { item: e.target.value })} placeholder="e.g. PVC pipe, ceiling fan capacitor" aria-label={`What was bought, line ${i + 1}`} />
                    <input className="input mono" value={r.q} onChange={(e) => setRow(i, { q: e.target.value })} inputMode="decimal" aria-label={`Quantity, line ${i + 1}`} />
                    <input className="input mono" value={r.u} onChange={(e) => setRow(i, { u: e.target.value })} inputMode="decimal" placeholder="0" aria-label={`Unit cost in Naira, line ${i + 1}`} />
                    <span className="mono cf-lt">{naira(lineTotal(r))}</span>
                    <button className="icon-btn" type="button" onClick={() => setForm({ ...form, rows: form.rows.length > 1 ? form.rows.filter((_, j) => j !== i) : [blankRow()] })} aria-label={`Remove line ${i + 1}`}><X size={15} /></button>
                  </div>
                ))}
              </div>
              <div className="hstack" style={{ justifyContent: "space-between" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, rows: [...form.rows, blankRow()] })}><Plus size={14} /> Add another item</button>
                <span>Total <b className="mono" style={{ fontSize: 17, marginLeft: 6 }}>{naira(total)}</b></span>
              </div>
              {error ? <div className="err-note" role="alert">{error}</div> : null}
              {saved ? <div className="pill-note t-ok" role="status"><Check size={16} /><span>{saved}</span></div> : null}
              <div className="hstack" style={{ justifyContent: "space-between" }}>
                <span className="hint">{form.unit ? `Recorded by ${me} for ${form.unit}` : ""}</span>
                <span className="hstack">
                  <button type="button" className="btn btn-ghost" onClick={() => { setForm({ unit: form.unit, job: "", supplier: "", date: today, rows: [blankRow()] }); setError(null); setSaved(null); }}>Clear</button>
                  <button type="button" className="btn btn-primary" disabled={pending} onClick={save}><Check size={15} /> {pending ? "Saving…" : "Save purchase"}</button>
                </span>
              </div>
            </div>
          </section>
        ) : (
          <div className="pill-note t-info"><Receipt size={16} /><span>View only. The Manager, Supervisor or Admin records purchases.</span></div>
        )}

        <div className="vstack" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-h"><h3>Resolved, cost not recorded</h3><span className="sp" />{miss.length ? <Badge tone="bad">{miss.length} {miss.length === 1 ? "job" : "jobs"}</Badge> : <Badge tone="ok" dot={false}>All done</Badge>}</div>
            <ul className="list">
              {miss.slice(0, 30).map((m) => (
                <li key={m.id} className="row">
                  <span className="stripe s-bad" />
                  <div className="m"><b>{m.title}</b><span>{dot(m.unit)}<span className="mono">{m.ref}</span> · {m.area} · {m.unit}</span></div>
                  {canManage ? <><button type="button" className="btn btn-secondary btn-sm" onClick={() => addCostFor(m.id, m.unit)}>Add cost</button><button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => markNoPurchaseAction(m.id))}>Nothing bought</button></> : null}
                </li>
              ))}
              {miss.length === 0 ? <li className="empty">Every finished job has its cost recorded.</li> : null}
            </ul>
          </section>
          <section className="card">
            <div className="card-h"><h3>Suppliers · {month.name}</h3><span className="sp" /><span className="sub">{uName}</span></div>
            <div className="card-b">
              {[...sup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, v]) => (
                <div key={name} className="hbar"><span>{name}</span><span className="tr"><span style={{ width: `${(v / smax) * 100}%`, background: "var(--acc)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{naira(v)}</span></div>
              ))}
              {sup.size === 0 ? <p className="muted" style={{ margin: 0 }}>Nothing bought in {month.name}.</p> : null}
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card-h">
          <h3>Everything bought</h3><span className="sub">{uName}</span><span className="sp" />
          <div className="seg" role="group" aria-label="Period">{([["week", "This week"], ["month", month.name], ["all", "All"]] as [Period, string][]).map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}</div>
        </div>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
          <div className="input-wrap" style={{ maxWidth: 360 }}><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, supplier, job or person" style={{ height: 36 }} autoComplete="off" aria-label="Search purchases" /></div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Bought</th><th>Unit</th><th>Item</th><th className="r">Qty</th><th className="r">Unit cost</th><th className="r">Total</th><th>Supplier</th><th>For</th><th>Recorded by</th>{canManage ? <th /> : null}</tr></thead>
            <tbody>
              {log.slice(0, 300).map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.dateText}</td>
                  <td>{dot(p.unit)}{p.unit}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 170 }}>{p.item}</td>
                  <td className="mono r">{p.quantity}</td>
                  <td className="mono r">{naira(p.unitCost)}</td>
                  <td className="mono r"><b>{naira(p.total)}</b></td>
                  <td>{p.supplier ?? "—"}</td>
                  <td>{p.jobId ? <><Link className="link mono" href={`${p.isRequest ? "/requests" : "/board"}?id=${p.jobId}`}>{p.jobRef}</Link> <span className="muted">{p.jobArea}</span></> : <span className="muted">Unit stock</span>}</td>
                  <td>{p.recordedBy}</td>
                  {canManage ? <td className="r"><button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label={`Void ${p.item}`} title="Void" onClick={() => { setReason(""); setVoiding(p); }}><Ban size={13} /></button></td> : null}
                </tr>
              ))}
              {log.length === 0 ? <tr><td colSpan={canManage ? 10 : 9} className="empty">Nothing bought in this period.</td></tr> : null}
            </tbody>
            <tfoot><tr><td colSpan={5} style={{ fontWeight: 600 }}>Total · {log.length} item{log.length === 1 ? "" : "s"}</td><td className="mono r"><b>{naira(sum(log))}</b></td><td colSpan={canManage ? 4 : 3} className="hint">A wrong line is voided with a reason; it’s never edited or deleted.</td></tr></tfoot>
          </table>
        </div>
      </section>

      <Drawer
        open={!!voiding}
        onClose={() => setVoiding(null)}
        over="Costs"
        title="Void this purchase line"
        sub={voiding ? `${voiding.item} · ${naira(voiding.total)} · ${voiding.dateText}` : undefined}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setVoiding(null)}>Cancel</button><button type="button" className="btn btn-danger" disabled={!reason.trim() || pending} onClick={() => voiding && run(() => voidExpenseAction(voiding.id, reason), () => setVoiding(null))}>{pending ? "Voiding…" : "Void line"}</button></>}
      >
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>The line stays on record, marked voided with your reason, and stops counting in the totals.</p>
        <Field label="Reason (required)"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" /></Field>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>
    </>
  );
}
