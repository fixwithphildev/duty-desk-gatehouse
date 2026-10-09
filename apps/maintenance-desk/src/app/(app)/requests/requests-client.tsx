"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Columns3, Inbox, Plus, Receipt, Users, Wrench } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Drawer } from "@/components/drawer";
import { Field } from "@/components/ui";
import { Badge, Kpi, priTone, stTone } from "@/components/suite";
import { JobDrawer, type Me } from "@/components/job-drawer";
import { askedBy, missingCost, stLabel, type JobView } from "@/lib/jobs";
import { COMMON_AREAS, MD_PRIORITIES, MD_UNITS, REQUEST_ROLES, UNIT_COLOR, formatNaira as naira } from "@/lib/types";
import { APARTMENTS } from "@/lib/apartments";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { createRequestAction } from "../jobs/actions";

type Tab = "open" | "done" | "all";
const STEPS: [string, string][] = [
  ["Take the order", "New request: who is asking, where, what needs doing, which unit and how urgent. No amount."],
  ["Do the work", "A technician from that unit starts the job, then records who finished it and when."],
  ["Record the cost", "On the Costs page, the unit enters what it bought for this request. Spending adds it all up by unit."],
];
const EMPTY = { fromMaintenance: true, person: "", name: "", role: "CEO", area: "", what: "", unit: "General Maintenance", priority: "Medium" };

export function RequestsClient({
  jobs,
  team,
  me,
  canManage,
  canMoney,
  canWorkAny,
  isHoO,
  initialId,
  initialUnit,
}: {
  jobs: JobView[];
  team: { byUnit: Record<string, string[]>; office: { name: string; role: string }[] };
  me: Me;
  canManage: boolean;
  canMoney: boolean;
  canWorkAny: boolean;
  isHoO: boolean;
  initialId: string | null;
  initialUnit: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [unit, setUnit] = useState(initialUnit);
  const [openId, setOpenId] = useState<string | null>(initialId);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("id", openId); else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
  }, [openId]);
  useEffect(() => { if (initialId) { const j = jobs.find((x) => x.id === initialId); if (j?.status === "Resolved") setTab("all"); } }, [initialId]);

  const inTab = (j: JobView, t: Tab) => t === "all" || (t === "open" ? j.status !== "Resolved" : j.status === "Resolved");
  const list = jobs.filter((j) => inTab(j, tab) && (unit === "all" || j.unit === unit)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const n = (t: Tab) => jobs.filter((j) => inTab(j, t)).length;
  const noCost = jobs.filter(missingCost).length;
  const byWho = new Map<string, number>();
  for (const j of jobs) { const k = j.requester?.unit ? "Maintenance team" : j.requester?.role ?? "Other"; byWho.set(k, (byWho.get(k) ?? 0) + 1); }
  const wmax = Math.max(1, ...byWho.values());
  const open = jobs.find((j) => j.id === openId) ?? null;

  // People in Maintenance who can ask for work: you first, then the Manager and Supervisor, and each unit's technicians.
  const people: { value: string; label: string; group: string }[] = [
    { value: `${me.name}|${me.unit ?? ""}`, label: `${me.name} (you)`, group: "You" },
    ...team.office.filter((p) => p.name !== me.name).map((p) => ({ value: `${p.name}|`, label: `${p.name} · ${p.role}`, group: "Office" })),
    ...MD_UNITS.flatMap((u) => (team.byUnit[u] ?? []).filter((name) => name !== me.name).map((name) => ({ value: `${name}|${u}`, label: `${name} · ${u}`, group: u }))),
  ];

  const spentLine = (j: JobView) =>
    j.lines.length ? `${naira(j.cost)} spent · ${j.lines.length} item${j.lines.length === 1 ? "" : "s"} on Costs`
      : j.noPurchase ? "Nothing needed buying"
      : j.status === "Resolved" ? <span style={{ color: "var(--bad-fg)" }}>Done, cost not recorded on Costs yet</span>
      : "Nothing recorded on Costs yet";

  const submit = () => {
    const [pname, punit] = form.person.split("|");
    const name = form.fromMaintenance ? pname : form.name;
    if (!name?.trim()) return setError(form.fromMaintenance ? "Choose who in Maintenance is asking." : "Say who is asking.");
    if (!form.area.trim()) return setError("Say where the work is.");
    if (!form.what.trim()) return setError("Describe what needs doing.");
    setError(null);
    startTransition(async () => {
      try {
        const r = await callAction(createRequestAction)({ fromMaintenance: form.fromMaintenance, name, role: form.role, staffUnit: punit ?? "", area: form.area, what: form.what, unit: form.unit, priority: form.priority });
        setNewOpen(false);
        setForm(EMPTY);
        setTab("open");
        setUnit("all");
        setFresh(r.id);
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Requests</h1><p>Orders for work that didn’t come from Duty Desk: the maintenance team’s own jobs, and anything asked for by the CEO, COO, managers, Security or other departments. What each unit spends on a request goes on the Costs page.</p></div>
        <div className="acts">
          <AutoRefresh />
          <Link href="/board" className="btn btn-secondary"><Columns3 size={15} /> Ticket Board</Link>
          {canManage ? <button type="button" className="btn btn-primary" onClick={() => { setForm({ ...EMPTY, person: people[0]?.value ?? "" }); setError(null); setNewOpen(true); }}><Plus size={15} /> New request</button> : null}
        </div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Users} label="Open requests" value={n("open")} ctx={`${jobs.length} in total`} />
        <Kpi icon={Clock} label="Not started" value={jobs.filter((j) => j.status === "Reported").length} ctx="waiting for a technician" />
        <Kpi icon={Wrench} label="In progress" value={jobs.filter((j) => j.status === "In Progress").length} ctx="being worked on" />
        <Kpi icon={CheckCircle2} label="Done" value={n("done")} ctx={canMoney && noCost ? `${noCost} still need${noCost === 1 ? "s" : ""} a cost on Costs` : "finished requests"} tile={canMoney && noCost ? "bad" : ""} />
      </div>

      <div className="g g-main g-split-c">
        <section className="card">
          <div className="tabs" role="tablist" style={{ paddingTop: 4 }}>
            {([["open", "Open"], ["done", "Done"], ["all", "All"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l} <span className="ct">{n(k)}</span></button>
            ))}
          </div>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <div className="seg" role="group" aria-label="Unit" style={{ flexWrap: "wrap" }}>
              {["all", ...MD_UNITS].map((u) => <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u === "all" ? "All units" : u}</button>)}
            </div>
          </div>
          <ul className="list">
            {list.map((j) => (
              <li key={j.id} className={`rq-row ${fresh === j.id ? "fresh" : ""}`}>
                <span className={`stripe s-${priTone(j.priority)}`} />
                <div className="vstack" style={{ gap: 4, minWidth: 0 }}>
                  <div className="hstack" style={{ gap: 8 }}><b>{j.title}</b><Badge tone={stTone(j.status)} dot={false}>{stLabel(j.status)}</Badge></div>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    <i className="dot-u" style={{ background: UNIT_COLOR[j.unit] ?? "var(--neu)" }} /><span className="mono">{j.ref}</span> · {j.area} · {j.unit} · asked by <b style={{ fontWeight: 600, color: "var(--text-2)" }}>{askedBy(j.requester)}</b> · {j.createdWhen}
                  </span>
                  {canMoney ? <span className="hint">{spentLine(j)}</span> : null}
                </div>
                <div className="vstack rq-acts">
                  {canManage ? <Link className="btn btn-secondary btn-sm" href={`/costs?job=${j.id}`}><Receipt size={14} /> Record cost</Link> : null}
                  <button type="button" className={`btn btn-${canManage ? "ghost" : "secondary"} btn-sm`} onClick={() => setOpenId(j.id)}>Open</button>
                </div>
              </li>
            ))}
            {list.length === 0 ? <li className="empty" style={{ padding: "24px 20px" }}>{jobs.length ? "No requests here." : canManage ? "No requests yet. Use New request when the maintenance team, management, Security or another department asks for work." : "No requests yet."}</li> : null}
          </ul>
        </section>

        <div className="vstack" style={{ gap: 18 }}>
          <section className="card">
            <div className="card-h"><h3>How a request works</h3></div>
            <ol className="ff-steps">{STEPS.map(([h, p], k) => <li key={h}><span className="ff-n">{k + 1}</span><div><b>{h}</b><span>{p}</span></div></li>)}</ol>
          </section>
          {jobs.length ? (
            <section className="card">
              <div className="card-h"><h3>Who asked</h3><span className="sp" /><span className="sub">requests</span></div>
              <div className="card-b vstack" style={{ gap: 10 }}>
                {[...byWho.entries()].sort((a, b) => b[1] - a[1]).map(([who, c]) => (
                  <div key={who} className="hbar"><span>{who}</span><span className="tr"><span style={{ width: `${(c / wmax) * 100}%`, background: "var(--cat3)" }} /></span><span className="mono" style={{ textAlign: "right" }}>{c}</span></div>
                ))}
              </div>
            </section>
          ) : null}
          <div className="pill-note t-info"><Inbox size={16} /><span>{canManage ? <>Anything a Resident Officer reports goes straight to the <b>Ticket Board</b>. Use <b>New request</b> for everything else.</> : isHoO ? "As Head of Operations you see every request and what was spent on it. Only the Manager, Supervisor or Admin can create requests or record costs." : "You can see every request and work on those for your unit. Only the Manager, Supervisor or Admin can create requests or record costs."}</span></div>
        </div>
      </div>

      <Drawer
        open={newOpen}
        onClose={() => setNewOpen(false)}
        over="Requests"
        title="New request"
        sub="An order for work not raised by Duty Desk: the maintenance team’s own jobs, management, Security or any other department"
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setNewOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={pending} onClick={submit}><Plus size={15} /> {pending ? "Saving…" : "Create request"}</button></>}
      >
        <div className="field">
          <span className="flabel">Who is asking</span>
          <div className="seg" role="group" aria-label="Who is asking">
            {([[true, "Someone in Maintenance"], [false, "Someone else"]] as const).map(([k, l]) => <button key={l} type="button" aria-pressed={form.fromMaintenance === k} onClick={() => setForm({ ...form, fromMaintenance: k })}>{l}</button>)}
          </div>
        </div>
        {form.fromMaintenance ? (
          <div className="field">
            <label htmlFor="rq-staff">Maintenance officer</label>
            <select className="input" id="rq-staff" value={form.person} onChange={(e) => { const u = e.target.value.split("|")[1]; setForm({ ...form, person: e.target.value, unit: u && (MD_UNITS as readonly string[]).includes(u) ? u : form.unit }); }}>
              {[...new Set(people.map((p) => p.group))].map((g) => <optgroup key={g} label={g}>{people.filter((p) => p.group === g).map((p) => <option key={p.value + p.group} value={p.value}>{p.label}</option>)}</optgroup>)}
            </select>
            <span className="hint">Choosing a technician sets their unit below. Change it if the job is for another unit.</span>
          </div>
        ) : (
          <div className="hstack" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <div className="field" style={{ flex: 1 }}><label htmlFor="rq-name">Name</label><input className="input" id="rq-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mrs. Funke Okoye" /></div>
            <div className="field" style={{ width: 170 }}><label htmlFor="rq-role">Their role</label><select className="input" id="rq-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{REQUEST_ROLES.filter((r) => r !== "Maintenance team").map((r) => <option key={r}>{r}</option>)}</select></div>
          </div>
        )}
        <div className="field">
          <label htmlFor="rq-area">Where</label>
          <input className="input" id="rq-area" list="rq-areas" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Main gate, Pool deck, Lisbon" autoComplete="off" />
          <datalist id="rq-areas">{[...COMMON_AREAS, ...APARTMENTS.map((a) => a.name)].map((a) => <option key={a} value={a} />)}</datalist>
        </div>
        <Field label="What needs doing"><textarea className="input" rows={3} value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} placeholder="e.g. Replace the faded signage at the main gate" /></Field>
        <div className="field"><span className="flabel">Unit</span><div className="seg" role="group" aria-label="Unit" style={{ flexWrap: "wrap" }}>{MD_UNITS.map((u) => <button key={u} type="button" aria-pressed={form.unit === u} onClick={() => setForm({ ...form, unit: u })}>{u}</button>)}</div></div>
        <div className="field"><span className="flabel">Priority</span><div className="seg" role="group" aria-label="Priority">{MD_PRIORITIES.map((p) => <button key={p} type="button" aria-pressed={form.priority === p} onClick={() => setForm({ ...form, priority: p })}>{p}</button>)}</div></div>
        <span className="hint">No amount here. When the unit buys anything for this request, it records it on the Costs page.</span>
        {error ? <div className="err-note" role="alert">{error}</div> : null}
      </Drawer>

      <JobDrawer job={open} onClose={() => { setOpenId(null); router.refresh(); }} team={team.byUnit} me={me} canManage={canManage} canMoney={canMoney} canWorkAny={canWorkAny} />
    </>
  );
}
