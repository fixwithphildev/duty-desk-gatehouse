"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Check, Clock, Download, LogOut, Mail } from "lucide-react";
import { Badge, Kpi } from "@/components/suite";
import { FundBars } from "@/components/fund-ui";
import { FUND_STAGE, TX_LABEL, fundDiff, fundNet, fundPct, type Funding } from "@/lib/funding";
import type { JobView } from "@/lib/jobs";
import { shortDate } from "@/lib/periods";
import { UNIT_COLOR, formatNaira as naira } from "@/lib/types";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { recordFundingAction, requestBalanceAction } from "./actions";

const num = (v: string) => parseFloat(v.replace(/[^0-9.]/g, ""));
const fmt = (v: number) => (v > 0 ? Math.round(v).toLocaleString("en-NG") : "");
const STEPS: [string, string][] = [
  ["Set the total", "Choose the job and enter what it needs in total, for example ₦100,000."],
  ["Record what Finance gives", "Save each payment as it comes, for example ₦50,000 up front, with the voucher number."],
  ["Buy as usual", "Units record what they buy on the Costs page. Spending can run ahead of what Finance has released."],
  ["Settle when it’s done", "When the job is finished, request the balance and record it when it’s paid, or record any money returned."],
];

export function FundingClient({ jobs, officers, canManage, today, initialJob }: { jobs: JobView[]; officers: string[]; canManage: boolean; today: string; initialJob: string }) {
  const router = useRouter();
  const blank = (job = "") => ({ job, need: "", amount: "", direction: "in" as "in" | "out", date: today, reference: "", officer: officers[0] ?? "", paysBack: "" });
  const [f, setF] = useState(() => {
    const j = jobs.find((x) => x.id === initialJob);
    return { ...blank(initialJob), amount: j ? defaultAmount(j, "in") : "" };
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function defaultAmount(j: JobView, dir: "in" | "out") {
    const fu = j.funding;
    const v = dir === "out" ? -fundDiff(fu, j.cost) : j.status === "Resolved" ? fundDiff(fu, j.cost) : (fu?.need ?? 0) - fundNet(fu);
    return fmt(v);
  }

  const funded = jobs.filter((j) => j.funding);
  const owed = funded.filter((j) => j.fundStage === "balance-due" || j.fundStage === "balance-requested");
  const ret = funded.filter((j) => j.fundStage === "return-due");
  const openF = funded.filter((j) => ["waiting", "part", "full"].includes(j.fundStage));
  const done = funded.filter((j) => j.fundStage === "settled");
  const released = funded.reduce((a, j) => a + fundNet(j.funding), 0);
  const owedSum = owed.reduce((a, j) => a + fundDiff(j.funding, j.cost), 0);
  const retSum = ret.reduce((a, j) => a - fundDiff(j.funding, j.cost), 0);
  const ahead = openF.reduce((a, j) => a + Math.max(0, j.cost - fundNet(j.funding)), 0);

  const job = jobs.find((j) => j.id === f.job);
  const isBalance = !!job && job.status === "Resolved" && f.direction === "in";

  const pick = (j: JobView, dir: "in" | "out") => {
    setF({ ...blank(j.id), direction: dir, amount: defaultAmount(j, dir) });
    setError(null);
    setSaved(null);
    document.getElementById("ff-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const summary = () => {
    if (!job) return <span className="muted">Choose a job to see how much is still to come.</span>;
    const fu = job.funding, need = num(f.need) || fu?.need || 0, amt = num(f.amount) || 0;
    const net = fundNet(fu) + (f.direction === "out" ? -amt : amt);
    if (!need) return <span className="muted">Enter what the job needs in total.</span>;
    if (job.status !== "Resolved") {
      const rest = need - net;
      return <>After saving, Finance will have released <b>{naira(net)}</b> of <b>{naira(need)}</b> ({Math.round((net / need) * 100)}%). {rest > 0 ? <><b>{naira(rest)}</b> is still to come when the job is done.</> : rest < 0 ? <>That’s <b>{naira(-rest)}</b> more than the job needs.</> : "The job will be fully funded."}</>;
    }
    const d = job.cost - net;
    return <>The job is finished and cost <b>{naira(job.cost)}</b>. After saving, Finance will have released <b>{naira(net)}</b>, so {d > 0 ? <>Finance will still owe <b>{naira(d)}</b>.</> : d < 0 ? <><b>{naira(-d)}</b> was not spent and should go back to Finance.</> : <>the job is <b>settled</b> with Finance.</>}</>;
  };

  const save = () => {
    if (!job) return setError("Choose the job.");
    const need = num(f.need);
    if (!(need > 0) && !job.funding?.need) return setError("Enter what the job needs in total, like 100,000.");
    if (!(num(f.amount) > 0)) return setError("Enter the amount, like 50,000.");
    setError(null);
    startTransition(async () => {
      try {
        await callAction(recordFundingAction)({ jobId: job.id, need: need > 0 ? need : null, direction: f.direction, amount: num(f.amount), date: f.date, reference: f.reference, financeOfficer: f.officer, paysBack: f.paysBack });
        setSaved(`${job.ref}: ${f.direction === "out" ? "returned to Finance" : isBalance ? "balance paid" : "money from Finance"} ${naira(num(f.amount))}`);
        setFresh(job.id);
        setF(blank());
        router.refresh();
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  const slip = (j: JobView) => {
    const fu = j.funding as Funding;
    const lines = [
      "BALANCE REQUEST · MAINTENANCE DESK", "",
      `Job: ${j.ref} · ${j.title}`, `Area: ${j.area}`, `Unit: ${j.unit}`, `Finished: ${j.resolvedWhen ?? ""}${j.resolvedBy ? " by " + j.resolvedBy : ""}`, "",
      `Amount needed:      ${naira(fu.need)}`,
      ...fu.tx.filter((x) => !x.void).map((x) => `${(TX_LABEL[x.kind] + " (" + shortDate(x.tx_date) + (x.reference ? ", " + x.reference : "") + "):").padEnd(44)}${x.kind === "return" ? "-" : ""}${naira(x.amount)}`),
      `Actually spent:     ${naira(j.cost)}`, "",
      `BALANCE DUE FROM FINANCE: ${naira(fundDiff(fu, j.cost))}`,
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-request-${j.ref}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = (fn: () => Promise<void>) => startTransition(async () => { try { await fn(); router.refresh(); } catch (e) { if (isRedirectError(e)) throw e; setError(errorMessage(e)); } });

  const rowActions = (j: JobView) => {
    if (!canManage) return null;
    const d = fundDiff(j.funding, j.cost);
    switch (j.fundStage) {
      case "waiting": case "part": case "full":
        return <button type="button" className="btn btn-secondary btn-sm" onClick={() => pick(j, "in")}><Banknote size={14} /> Record money from Finance</button>;
      case "balance-due":
        return <><button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => callAction(requestBalanceAction)(j.id, d))}><Mail size={14} /> Request balance</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => pick(j, "in")}>Record balance paid</button></>;
      case "balance-requested":
        return <><button type="button" className="btn btn-primary btn-sm" onClick={() => pick(j, "in")}><Check size={14} /> Record balance paid</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => slip(j)}><Download size={14} /> Request slip</button></>;
      case "return-due":
        return <button type="button" className="btn btn-primary btn-sm" onClick={() => pick(j, "out")}><Check size={14} /> Record money returned</button>;
      default:
        return null;
    }
  };

  const row = (j: JobView) => {
    const st = FUND_STAGE[j.fundStage as keyof typeof FUND_STAGE], d = fundDiff(j.funding, j.cost), fu = j.funding as Funding;
    const live = fu.tx.filter((x) => !x.void);
    return (
      <li key={j.id} className={`fund-row ${fresh === j.id ? "fresh" : ""}`}>
        <span className={`stripe s-${st.tone}`} />
        <div className="vstack" style={{ gap: 6, minWidth: 0 }}>
          <div className="hstack" style={{ gap: 8 }}><b>{j.title}</b><Badge tone={st.tone} dot={false}>{st.label}</Badge></div>
          <span className="muted" style={{ fontSize: 12.5 }}><i className="dot-u" style={{ background: UNIT_COLOR[j.unit] ?? "var(--neu)" }} /><span className="mono">{j.ref}</span> · {j.area} · {j.unit}{j.requester ? ` · ${j.requester.role} request` : ""} · {j.status === "Resolved" ? `finished ${j.resolvedWhen ?? ""}` : j.status === "In Progress" ? "in progress" : "not started"}</span>
          <FundBars f={fu} spent={j.cost} />
          {live.length ? <span className="hint">{live.map((x) => `${shortDate(x.tx_date)}: ${TX_LABEL[x.kind].toLowerCase()} ${naira(x.amount)}${x.reference ? ` (${x.reference})` : ""}`).join(" · ")}</span> : null}
        </div>
        <div className="vstack fund-side">
          <span className={`fund-big ${j.status === "Resolved" && d > 0 ? "owed" : j.status === "Resolved" && d < 0 ? "ret" : ""}`}>{j.status !== "Resolved" ? `${fundPct(fu)}% released` : d > 0 ? `Finance owes ${naira(d)}` : d < 0 ? `Return ${naira(-d)}` : "Settled"}</span>
          <div className="vstack" style={{ gap: 6, alignItems: "stretch" }}>
            {rowActions(j)}
            <Link className="btn btn-ghost btn-sm" href={`${j.isRequest ? "/requests" : "/board"}?id=${j.id}`}>Open job</Link>
          </div>
        </div>
      </li>
    );
  };

  const section = (title: string, list: JobView[], empty: string, note?: string) => (
    <section className="card">
      <div className="card-h"><h3>{title}</h3><span className="sp" /><Badge tone={list.length ? "neu" : "ok"} dot={false}>{list.length} job{list.length === 1 ? "" : "s"}</Badge></div>
      {note ? <p className="hint" style={{ margin: 0, padding: "10px 20px 0" }}>{note}</p> : null}
      <ul className="list">{list.length ? list.map(row) : <li className="empty">{empty}</li>}</ul>
    </section>
  );

  const group = (label: string, list: JobView[]) => list.length ? <optgroup label={label}>{list.map((x) => <option key={x.id} value={x.id}>{x.ref} · {x.title} · {x.unit}{x.funding ? ` · ${fundPct(x.funding)}% released` : ""}</option>)}</optgroup> : null;
  const recentDone = jobs.filter((x) => x.status === "Resolved" && (x.funding || (x.resolvedAt && Date.now() - new Date(x.resolvedAt).getTime() < 60 * 86400000)));

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Funding</h1><p>Money Finance releases for jobs. Finance often pays part up front and the rest when the job is done; this keeps track of what was released, what was spent, and the balance still owed either way.</p></div>
        <div className="acts"><a className="btn btn-secondary" href="/funding/export"><Download size={15} /> Finance statement</a></div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Banknote} label="Released by Finance" value={naira(released)} ctx={`across ${funded.length} job${funded.length === 1 ? "" : "s"}`} />
        <Kpi icon={AlertTriangle} label="Finance still owes" value={naira(owedSum)} ctx={`${owed.length} finished job${owed.length === 1 ? "" : "s"} · request the balance`} tile={owedSum ? "bad" : ""} />
        <Kpi icon={LogOut} label="To return to Finance" value={naira(retSum)} ctx={`${ret.length} job${ret.length === 1 ? "" : "s"} spent less than released`} tile={retSum ? "warn" : ""} />
        <Kpi icon={Clock} label="Spent ahead of funding" value={naira(ahead)} ctx="on jobs still in progress, on credit or out of pocket" />
      </div>

      <div className="g g-main g-split-c">
        {canManage ? (
          <section className="card" id="ff-card">
            <div className="card-h"><h3>Record money from Finance</h3><span className="sp" /><span className="sub">any job, any amount</span></div>
            <div className="card-b vstack" style={{ gap: 14 }}>
              <div className="field">
                <label htmlFor="ff-job">Job</label>
                <select className="input" id="ff-job" value={f.job} onChange={(e) => { const j = jobs.find((x) => x.id === e.target.value); setF({ ...f, job: e.target.value, need: "", amount: j ? defaultAmount(j, f.direction) : "" }); }}>
                  <option value="">Choose the job…</option>
                  {group("Already getting money from Finance", jobs.filter((x) => x.funding && x.status !== "Resolved"))}
                  {group("In progress", jobs.filter((x) => !x.funding && x.status === "In Progress"))}
                  {group("Not started yet", jobs.filter((x) => !x.funding && x.status === "Reported"))}
                  {group("Finished", recentDone)}
                </select>
                {job ? <span className="hint"><i className="dot-u" style={{ background: UNIT_COLOR[job.unit] ?? "var(--neu)" }} />{job.unit} · {job.area} · {job.status === "Resolved" ? "finished" : job.status === "In Progress" ? "in progress" : "not started"} · spent so far {naira(job.cost)}{job.funding ? ` · already released ${naira(fundNet(job.funding))}` : " · nothing from Finance yet"}</span> : <span className="hint">Any request, or any job on the Ticket Board.</span>}
              </div>
              <div className="field">
                <span className="flabel">What happened</span>
                <div className="seg" role="group" aria-label="Direction">{([["in", "Finance gave money"], ["out", "We returned money to Finance"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={f.direction === k} onClick={() => setF({ ...f, direction: k, amount: job ? defaultAmount(job, k) : f.amount })}>{l}</button>)}</div>
              </div>
              <div className="hstack cf-meta" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <div className="field" style={{ flex: 1 }}><label htmlFor="ff-need">Total the job needs (₦)</label><input className="input mono" id="ff-need" inputMode="decimal" value={f.need || (job?.funding?.need ? fmt(job.funding.need) : "")} onChange={(e) => setF({ ...f, need: e.target.value })} placeholder="e.g. 100,000" /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="ff-amt">{f.direction === "out" ? "Amount returned (₦)" : isBalance ? "Balance Finance paid (₦)" : "Amount Finance gave now (₦)"}</label><input className="input mono" id="ff-amt" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="e.g. 50,000" /></div>
              </div>
              <div className="hstack cf-meta" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <div className="field" style={{ width: 170 }}><label htmlFor="ff-date">Date</label><input className="input mono" id="ff-date" type="date" value={f.date} max={today} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="ff-ref">{f.direction === "out" ? "Receipt number" : "Voucher or transfer ref"}</label><input className="input mono" id="ff-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="e.g. PV-1201" /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="ff-by">Finance officer</label><input className="input" id="ff-by" list="ff-fin" value={f.officer} onChange={(e) => setF({ ...f, officer: e.target.value })} placeholder="e.g. Mrs. Grace Eze" /><datalist id="ff-fin">{officers.map((o) => <option key={o} value={o} />)}</datalist></div>
              </div>
              {isBalance ? <div className="field"><label htmlFor="ff-pb">What the balance pays back <span className="muted">(optional)</span></label><input className="input" id="ff-pb" value={f.paysBack} onChange={(e) => setF({ ...f, paysBack: e.target.value })} placeholder="e.g. Kingsway Hardware (bought on credit), or Segun Ojo (own money)" /></div> : null}
              <div className="ff-sum" aria-live="polite">{summary()}</div>
              {error ? <div className="err-note" role="alert">{error}</div> : null}
              {saved ? <div className="pill-note t-ok" role="status"><Check size={16} /><span>{saved}</span></div> : null}
              <div className="hstack" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setF(blank()); setError(null); setSaved(null); }}>Clear</button>
                <button type="button" className="btn btn-primary" disabled={pending} onClick={save}><Check size={15} /> {pending ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </section>
        ) : (
          <div className="pill-note t-info"><Banknote size={16} /><span>View only. The Manager, Supervisor or Admin records money from Finance.</span></div>
        )}
        <section className="card">
          <div className="card-h"><h3>How it works</h3></div>
          <ol className="ff-steps">{STEPS.map(([h, p], k) => <li key={h}><span className="ff-n">{k + 1}</span><div><b>{h}</b><span>{p}</span></div></li>)}</ol>
        </section>
      </div>

      {section("Finished: Finance owes the balance", owed, "No balances owed by Finance.", "Send the request, then record the payment when Finance pays. Note who the balance pays back, such as a supplier who gave credit.")}
      {section("Finished: money to return to Finance", ret, "Nothing to return.")}
      {section("In progress: part-funded or waiting", openF, "No funded jobs in progress. Use the form above to record money for a job.")}
      {section("Settled", done, "Nothing settled yet.")}
    </>
  );
}
