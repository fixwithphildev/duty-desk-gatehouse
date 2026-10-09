import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2, Columns3, Inbox, Plus, Receipt, UserRound, Users, Wrench } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { MD_MANAGE_ROLES, MD_MONEY_ROLES, MD_REQUEST_ROLES, MD_UNITS, UNIT_COLOR, formatNaira as naira } from "@/lib/types";
import { getDesk, getMyUnit } from "@/lib/data/desk";
import { missingCost, PRI_RANK, type JobView } from "@/lib/jobs";
import { fundDiff } from "@/lib/funding";
import { clockTime, lagosDayKey, lagosHour, todayLong } from "@/lib/time";
import { thisMonth, thisWeek } from "@/lib/periods";
import { AutoRefresh } from "@/components/auto-refresh";
import { Kpi } from "@/components/suite";
import { UnitIcon } from "@/components/unit-icon";

const pl = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const jobHref = (j: JobView) => `${j.isRequest ? "/requests" : "/board"}?id=${j.id}`;

export default async function DashboardPage() {
  const session = await requireSession();
  const isTech = session.role === "maintenance_technician";
  const [{ jobs, expenses }, unit] = await Promise.all([getDesk(), isTech ? getMyUnit(session.staffId) : Promise.resolve(null)]);
  const mine = (j: JobView) => !unit || j.unit === unit;
  const live = jobs.filter((j) => !j.void && mine(j));
  const open = live.filter((j) => j.status !== "Resolved");
  const boardOpen = open.filter((j) => !j.isRequest), reqOpen = open.filter((j) => j.isRequest), prog = open.filter((j) => j.status === "In Progress");
  const high = boardOpen.filter((j) => j.priority === "High").length;
  const doneToday = live.filter((j) => j.resolvedToday).sort((a, b) => (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? ""));
  const attention = [...open].sort((a, b) => PRI_RANK[a.priority] - PRI_RANK[b.priority] || (a.status === "Reported" ? 0 : 1) - (b.status === "Reported" ? 0 : 1) || a.createdAt.localeCompare(b.createdAt)).slice(0, 7);
  const allOpen = jobs.filter((j) => !j.void && j.status !== "Resolved");
  const noUnit = isTech ? 0 : allOpen.filter((j) => j.needsUnit).length;

  const h = lagosHour(), greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const name = session.role === "head_of_operations" ? "" : `, ${/^(Mr|Mrs|Ms|Dr)\.? /.test(session.displayName) ? session.displayName : session.displayName.split(" ")[0]}`;

  // Today, newest first: new jobs and requests, work started and finished.
  const today = lagosDayKey(new Date().toISOString());
  const ev: { at: string; icon: "bell" | "inbox" | "start" | "done"; text: React.ReactNode; href: string }[] = [];
  for (const j of live) {
    if (lagosDayKey(j.createdAt) === today) ev.push({ at: j.createdAt, icon: j.isRequest ? "inbox" : "bell", text: <>{j.isRequest ? <>New request {j.ref} from <b>{j.requester?.name}</b></> : <>New from Duty Desk: {j.ref}</>} · {j.title} · {j.area}</>, href: jobHref(j) });
    if (j.startedAt && lagosDayKey(j.startedAt) === today) ev.push({ at: j.startedAt, icon: "start", text: <><b>{j.startedBy}</b> started {j.ref} · {j.title}</>, href: jobHref(j) });
    if (j.resolvedToday && j.resolvedAt) ev.push({ at: j.resolvedAt, icon: "done", text: <>{j.resolvedBy ? <b>{j.resolvedBy}</b> : "Someone"} finished {j.ref} · {j.title}</>, href: jobHref(j) });
  }
  ev.sort((a, b) => b.at.localeCompare(a.at));
  const EV_ICON = { bell: Bell, inbox: Inbox, start: UserRound, done: CheckCircle2 };

  let money: React.ReactNode = null;
  if (MD_MONEY_ROLES.includes(session.role)) {
    const wk = thisWeek(), mo = thisMonth();
    const lines = expenses.filter((e) => !unit || e.unit === unit);
    const sumIn = (from: string, to: string) => lines.filter((e) => e.purchased_on >= from && e.purchased_on <= to);
    const wkL = sumIn(wk.from, wk.to), moL = sumIn(mo.from, mo.to);
    const total = (l: typeof lines) => l.reduce((a, e) => a + e.line_total, 0);
    const owed = jobs.filter((j) => !j.void && (j.fundStage === "balance-due" || j.fundStage === "balance-requested"));
    const ret = jobs.filter((j) => !j.void && j.fundStage === "return-due");
    const miss = jobs.filter(missingCost).filter(mine).length;
    const owedSum = owed.reduce((a, j) => a + fundDiff(j.funding, j.cost), 0), retSum = ret.reduce((a, j) => a - fundDiff(j.funding, j.cost), 0);
    const tiles: [string, string, string, string, string][] = [
      ["Spent this week", naira(total(wkL)), `${pl(wkL.length, "item")} bought`, "/spending", ""],
      [`Spent in ${mo.name}`, naira(total(moL)), `${pl(new Set(moL.filter((e) => e.ticket_id).map((e) => e.ticket_id)).size, "job")} with purchases`, "/spending", ""],
      ["Done, cost not recorded", String(miss), miss ? "record them on Costs" : "all recorded", "/costs", miss ? "bad" : ""],
      ["Finance still owes", naira(owedSum), pl(owed.length, "finished job"), "/funding", owedSum ? "bad" : ""],
      ["To return to Finance", naira(retSum), pl(ret.length, "job"), "/funding", retSum ? "warn" : ""],
    ];
    money = (
      <section className="card">
        <div className="card-h"><h3>Money</h3><span className="sp" /><span className="sub">from Costs and Funding · tap to open</span></div>
        <div className="dash-money">{tiles.map(([l, v, c, href, tone]) => <Link key={l} href={href} className={`dm ${tone ? "dm-" + tone : ""}`} style={{ textDecoration: "none" }}><span>{l}</span><b className="mono">{v}</b><span className="muted">{c}</span></Link>)}</div>
      </section>
    );
  }

  return (
    <>
      <div className="phead">
        <div className="t">
          <span className="over">{todayLong()}</span>
          <h1>{greet}{name}</h1>
          <p>{unit ? `${unit}: ` : ""}{pl(boardOpen.length, "Duty Desk job")} open{high ? ` (${high} high priority)` : ""} and {pl(reqOpen.length, "request")}. {doneToday.length} finished today.</p>
        </div>
        <div className="acts">
          <AutoRefresh />
          <Link href="/board" className="btn btn-secondary"><Columns3 size={15} /> Ticket Board</Link>
          {MD_MANAGE_ROLES.includes(session.role) ? <Link href="/costs" className="btn btn-secondary"><Receipt size={15} /> Record a purchase</Link> : null}{MD_REQUEST_ROLES.includes(session.role) ? <Link href="/requests" className="btn btn-primary"><Plus size={15} /> New request</Link> : null}
        </div>
      </div>

      <div className="kpis k4">
        <Kpi icon={Columns3} label="Duty Desk jobs open" value={boardOpen.length} ctx={`${high} high priority · ${boardOpen.filter((j) => j.status === "Reported").length} not started`} tile={high ? "bad" : ""} />
        <Kpi icon={Users} label="Requests open" value={reqOpen.length} ctx={`${reqOpen.filter((j) => j.status === "Reported").length} not started`} />
        <Kpi icon={Wrench} label="In progress" value={prog.length} ctx={`${pl(new Set(prog.map((j) => j.startedBy).filter(Boolean)).size, "technician")} working`} />
        <Kpi icon={CheckCircle2} label="Finished today" value={doneToday.length} ctx={doneToday[0] ? `last by ${doneToday[0].resolvedBy ?? "someone"} at ${doneToday[0].resolvedAt ? clockTime(doneToday[0].resolvedAt) : ""}` : "nothing yet"} />
      </div>

      <div className="g g-main">
        <section className="card">
          <div className="card-h"><h3>Needs attention</h3><span className="sub">high priority and not started first</span><span className="sp" /><Link href="/board" className="link">Ticket Board <ArrowRight size={13} /></Link></div>
          <ul className="list">
            {attention.map((j) => (
              <li key={j.id}>
                <Link href={jobHref(j)} className="row click" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className={`stripe s-${j.priority === "High" ? "bad" : j.priority === "Medium" ? "warn" : "info"}`} />
                  <div className="m"><b>{j.title}</b><span><i className="dot-u" style={{ background: UNIT_COLOR[j.unit] ?? "var(--neu)" }} /><span className="mono">{j.ref}</span> · {j.area} · {j.isRequest ? `request from ${j.requester?.name}` : "Duty Desk"}{j.status === "In Progress" && j.startedBy ? ` · ${j.startedBy}` : ""}</span></div>
                  <span className="age">{j.age}</span>
                </Link>
              </li>
            ))}
            {attention.length === 0 ? <li className="empty">Nothing open. All caught up.</li> : null}
          </ul>
        </section>
        <section className="card">
          <div className="card-h"><h3>Open work by unit</h3><span className="sp" /><span className="sub">jobs and requests</span></div>
          <ul className="list">
            {MD_UNITS.map((u) => {
              const o = allOpen.filter((j) => j.unit === u), jobsN = o.filter((j) => !j.isRequest).length, hi = o.filter((j) => j.priority === "High").length;
              return (
                <li key={u}>
                  <Link href={jobsN ? `/board?unit=${encodeURIComponent(u)}` : "/requests"} className="row click" style={{ textDecoration: "none", color: "inherit", ["--uc" as string]: UNIT_COLOR[u] }}>
                    <span className="u-ic"><UnitIcon unit={u} /></span>
                    <div className="m"><b>{u}{unit === u ? <span className="muted" style={{ fontWeight: 400 }}> (your unit)</span> : null}</b><span>{o.length ? `${pl(jobsN, "job")} · ${pl(o.length - jobsN, "request")} · ${o.filter((j) => j.status === "In Progress").length} in progress` : "Nothing open"}</span></div>
                    {hi ? <span className="badge t-bad"><span className="d" />{hi} high</span> : null}
                  </Link>
                </li>
              );
            })}
            {noUnit ? (
              <li>
                <Link href="/board?unit=needs" className="row click" style={{ textDecoration: "none", color: "inherit", ["--uc" as string]: "var(--warn)" }}>
                  <span className="u-ic"><Wrench size={15} /></span>
                  <div className="m"><b>Needs a unit</b><span>{pl(noUnit, "older job")} filed under “Engineering”. Open and choose its unit.</span></div>
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Being worked on</h3><span className="sp" /><span className="sub">{pl(prog.length, "job")}</span></div>
          <ul className="list">
            {prog.map((j) => (
              <li key={j.id}>
                <Link href={jobHref(j)} className="row click" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="u-ic" style={{ ["--uc" as string]: UNIT_COLOR[j.unit] ?? "var(--neu)" }}><UserRound size={15} /></span>
                  <div className="m"><b>{j.startedBy ?? "Not recorded"}</b><span>{j.title} · {j.area} · since {j.startedWhen?.replace(/^Today /, "") ?? j.age}</span></div>
                  <span className="mono muted" style={{ fontSize: 12 }}>{j.ref}</span>
                </Link>
              </li>
            ))}
            {prog.length === 0 ? <li className="empty">No one has started a job yet.</li> : null}
          </ul>
        </section>
        <section className="card">
          <div className="card-h"><h3>Today</h3><span className="sp" /><span className="sub">newest first</span></div>
          {ev.length ? (
            <ul className="tl">
              {ev.slice(0, 14).map((e, i) => { const Icon = EV_ICON[e.icon]; return <li key={i}><span className="tm">{clockTime(e.at)}</span><span className="dt"><Icon size={11} /></span><span className="tx"><Link href={e.href} style={{ color: "inherit", textDecoration: "none" }}>{e.text}</Link></span></li>; })}
            </ul>
          ) : <div className="empty" style={{ padding: 24 }}>Nothing has happened yet today.</div>}
        </section>
      </div>

      {money}
    </>
  );
}
