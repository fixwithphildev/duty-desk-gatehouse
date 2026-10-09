import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardCheck, ClipboardList, DoorOpen, ListTodo, MessageSquareWarning, Wrench, LayoutGrid, BookOpen, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { getAllChecklists } from "@/lib/data/checklists";
import { getComplaints, getComplaintsDailyTrend } from "@/lib/data/complaints";
import { getMaintenanceTickets, getTicketsDailyTrend } from "@/lib/data/maintenance";
import { getTasks } from "@/lib/data/tasks";
import { getDutyLog, getLastHandover } from "@/lib/data/dutylog";
import { getReadiness, countByStatus, leavingToday, todoList } from "@/lib/data/readiness";
import { aptShort } from "@/lib/apartments";
import { byDue, taskState } from "@/lib/tasks";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Kpi, PageHead } from "@/components/suite";
import { ageText, clockTime, dayText, lagosDayKey, lagosHour, shiftName, todayLong, whenText } from "@/lib/time";
import { HandoverBanner } from "./handover-banner";
import { LiveQueue, type QueueItem } from "./live-queue";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export default async function DashboardPage() {
  const session = await requireSession();
  if (session.role === "front_desk") redirect("/frontdesk");
  const firstName = session.displayName.split(" ")[0];

  const [readiness, checklists, complaints, tickets, tasks, handover, log, complaintTrend, ticketTrend] = await Promise.all([
    getReadiness(),
    getAllChecklists(),
    getComplaints(),
    getMaintenanceTickets(),
    getTasks(),
    getLastHandover(),
    getDutyLog(),
    getComplaintsDailyTrend(7),
    getTicketsDailyTrend(7),
  ]);

  const c = countByStatus(readiness), todo = todoList(readiness), empty = readiness.length - c.occupied;
  const inspecting = readiness.filter((r) => r.status === "inspecting");
  const repairs = readiness.filter((r) => r.status === "notready");
  const leaving = leavingToday(readiness);
  const myDraft = readiness.find((r) => r.draft?.prepared_by === session.staffId);
  const openComplaints = complaints.filter((x) => !x.void && x.status !== "Resolved");
  const openTickets = tickets.filter((x) => !x.void && x.status !== "Resolved");
  // Today's list: overdue, then to do by time, then what's been done today.
  const dayTasks = tasks.filter((t) => !t.void).map((t) => ({ ...t, state: taskState(t) })).filter((t) => t.state !== "earlier");
  const late = dayTasks.filter((t) => t.state === "overdue").sort(byDue);
  const pendingTasks = [...late, ...dayTasks.filter((t) => t.state === "todo").sort(byDue)];
  const liveTasks = [...pendingTasks, ...dayTasks.filter((t) => t.state === "done")];
  const nextTask = pendingTasks.find((t) => t.state === "todo" && t.due_time);
  const oldestComplaint = [...openComplaints].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

  // Check-in preps submitted each day for the last 14 days (Lagos days), split Ready / Not ready.
  const preps = checklists.filter((x) => !x.void && x.type === "check_in_prep");
  const days = Array.from({ length: 14 }, (_, i) => lagosDayKey(new Date(Date.now() - (13 - i) * 86400000).toISOString()));
  const perDay = days.map((d) => ({ d, ready: preps.filter((x) => x.overall_ready && lagosDayKey(x.created_at) === d).length, not: preps.filter((x) => !x.overall_ready && lagosDayKey(x.created_at) === d).length }));
  const readyTrend = perDay.slice(-7).map((p) => p.ready), prepTrend = perDay.slice(-7).map((p) => p.ready + p.not);

  const queue: QueueItem[] = [
    ...openComplaints.map((x) => ({ kind: "c" as const, id: x.id, title: x.description, meta: `${x.room ? x.room + " · " : ""}${x.category}`, pri: x.priority, status: x.status, age: ageText(x.created_at), href: `/complaints?id=${x.id}` })),
    ...openTickets.map((x) => ({ kind: "t" as const, id: x.id, title: x.issue_type, meta: `${x.area} · ${x.assigned_to}${x.source === "checklist" ? " · from checklist" : ""}`, pri: x.priority, status: x.status, age: ageText(x.created_at), href: `/maintenance?id=${x.id}` })),
  ];

  const activity = [
    ...preps.slice(0, 8).map((x) => ({ at: x.created_at, icon: "clip", text: <><b>{x.prepared_by_name}</b> submitted {x.apartment} · {x.overall_ready ? "Ready" : "Not ready"}</> })),
    ...complaints.filter((x) => !x.void).slice(0, 8).map((x) => ({ at: x.created_at, icon: "msg", text: <>Complaint logged{x.room ? <> · <b>{x.room}</b></> : null}: {x.description}</> })),
    ...tickets.filter((x) => !x.void).slice(0, 8).map((x) => ({ at: x.created_at, icon: "wrench", text: <>{x.source === "checklist" ? "Ticket opened from a checklist" : "Ticket logged"}: <b>{x.issue_type}</b> · {x.area}</> })),
    ...log.filter((x) => !x.void).slice(0, 4).map((x) => ({ at: x.created_at, icon: "book", text: <><b>{x.officer_name}</b> {x.handover ? "wrote a handover note" : "added to the duty log"}</> })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const ACT_ICON = { clip: ClipboardCheck, msg: MessageSquareWarning, wrench: Wrench, book: BookOpen } as const;

  const hour = lagosHour();
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const canPrep = DD_CAN_EDIT_CHECKLISTS.includes(session.role);
  const W = 560, H = 190, L = 28, B = 22, bw = (W - L) / 14;
  const max = Math.max(4, ...perDay.map((p) => p.ready + p.not));

  return (
    <>
      <PageHead
        over={`${todayLong()} · ${shiftName()}`}
        title={`Good ${partOfDay}, ${firstName}`}
        sub={<>{plural(todo.length, "apartment")} need{todo.length === 1 ? "s" : ""} a check-in prep before front desk can sell {todo.length === 1 ? "it" : "them"}. {plural(inspecting.length, "inspection")} in progress.{handover ? " The last shift’s handover is waiting for you." : ""}</>}
      >
        <AutoRefresh />
        {canPrep && myDraft ? (
          <Link href={`/checklists/${myDraft.draft!.id}`} className="btn btn-primary"><ClipboardCheck size={15} /> Continue inspection · {myDraft.apartment.name}</Link>
        ) : (
          <Link href="/board" className="btn btn-primary"><LayoutGrid size={15} /> Readiness Board</Link>
        )}
      </PageHead>

      <HandoverBanner handover={handover ? { id: handover.id, officer_name: handover.officer_name, notes: handover.notes, when: whenText(handover.created_at), mine: handover.officer_id === session.staffId } : null} />

      <div className="kpis">
        <Kpi icon={DoorOpen} label="Ready to sell" value={c.ready} unit={`/ ${empty} empty`} ctx={c.recheck ? `${c.recheck} re-check due` : "front desk can sell these"} data={readyTrend} sparkTone="ok" />
        <Kpi icon={ClipboardList} label="Checklists to do" value={todo.length} ctx={`${c.unchecked} need checklist · ${c.recheck} re-check`} data={prepTrend} tile={todo.length ? "warn" : ""} />
        <Kpi icon={MessageSquareWarning} label="Open complaints" value={openComplaints.length} ctx={oldestComplaint ? `oldest ${ageText(oldestComplaint.created_at)}${oldestComplaint.room ? " · " + oldestComplaint.room : ""}` : "none open"} data={complaintTrend.map((x) => x.value)} tile={openComplaints.length ? "warn" : ""} />
        <Kpi icon={Wrench} label="Open maintenance" value={openTickets.length} ctx={`${openTickets.filter((t) => t.priority === "High").length} high priority`} data={ticketTrend.map((x) => x.value)} />
        <Kpi icon={ListTodo} label="Tasks to do" value={pendingTasks.length} unit={`/ ${liveTasks.length}`} ctx={late.length ? `${late.length} overdue` : nextTask ? `next ${nextTask.due_time} · ${nextTask.description}` : "nothing due"} tile={late.length ? "bad" : ""} />
      </div>

      <div className="g g-main">
        <section className="card">
          <div className="card-h"><h3>Readiness</h3><span className="sub">{readiness.length} apartments · from the latest checklists</span><span className="sp" /><Link href="/board" className="link">Open board <ArrowRight size={13} /></Link></div>
          <div className="card-b vstack" style={{ gap: 14 }}>
            {(["Main Building", "Studio Wings"] as const).map((label) => {
              const list = readiness.filter((r) => (label === "Main Building") === (r.apartment.building === "Main Building"));
              const k = countByStatus(list), seg = (v: number, cls: string, l: string) => (v ? <span className={cls} style={{ flex: v }} title={`${v} ${l}`} /> : null);
              return (
                <div key={label} className="bldg">
                  <div><b>{label}</b><span>{list.length} {label === "Main Building" ? "apartments" : "studios"}</span></div>
                  <div className="sbar" role="img" aria-label={`${label}: ${k.ready} ready to sell, ${k.recheck} re-check due, ${k.notready} not ready, ${k.inspecting} inspecting, ${k.unchecked} need a checklist, ${k.occupied} occupied`}>
                    {seg(k.ready, "s-ok", "ready to sell")}{seg(k.recheck, "s-warn", "re-check due")}{seg(k.notready, "s-bad", "not ready")}{seg(k.inspecting, "s-info", "inspecting")}{seg(k.unchecked, "s-un", "need a checklist")}{seg(k.occupied, "s-neu", "occupied")}
                  </div>
                  <span className="muted">{k.ready} of {list.length - k.occupied} empty ready</span>
                </div>
              );
            })}
            <div className="legend">
              <span><i style={{ background: "var(--ok)" }} />Ready to sell {c.ready}</span><span><i style={{ background: "var(--warn)" }} />Re-check {c.recheck}</span>
              <span><i style={{ background: "var(--bad)" }} />Not ready {c.notready}</span><span><i style={{ background: "var(--info)" }} />Inspecting {c.inspecting}</span>
              <span><i style={{ border: "1px dashed var(--line-strong)" }} />Needs checklist {c.unchecked}</span><span><i style={{ background: "var(--neu)" }} />Occupied {c.occupied}</span>
            </div>
            <hr className="sep" />
            {leaving.length ? (
              <>
                <span className="over">Check-outs today · {leaving.length}</span>
                <ul className="list">
                  {leaving.slice(0, 6).map((r) => (
                    <li key={r.apartment.name}>
                      <Link href={`/board?apt=${encodeURIComponent(r.apartment.name)}`} className="row click" style={{ padding: "9px 0", textDecoration: "none", color: "inherit" }}>
                        <span className="stripe s-info" />
                        <div className="m"><b>{r.apartment.name}</b><span>{r.stay!.guest} · record the check-out when they leave</span></div>
                        <span className="age">{aptShort(r.apartment)}</span>
                        <Badge tone="info">Leaves today</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <span className="over">Checklists to do · {todo.length}</span>
            <ul className="list">
              {todo.slice(0, 6).map((r) => (
                <li key={r.apartment.name}>
                  <Link href={`/board?apt=${encodeURIComponent(r.apartment.name)}`} className="row click" style={{ padding: "9px 0", textDecoration: "none", color: "inherit" }}>
                    <span className={`stripe ${r.status === "recheck" ? "s-warn" : "s-neu"}`} />
                    <div className="m"><b>{r.apartment.name}</b><span>{r.status === "recheck" ? "Ready check expired, still unsold" : r.lastCheckout ? `Guest checked out ${whenText(r.lastCheckout.at)}` : "No check-in prep yet"}</span></div>
                    <span className="age">{aptShort(r.apartment)}</span>
                    <Badge tone={r.status === "recheck" ? "warn" : "neu"} dot={r.status === "recheck"}>{r.status === "recheck" ? "Re-check" : "Needs checklist"}</Badge>
                  </Link>
                </li>
              ))}
              {todo.length > 6 ? <li className="hint" style={{ padding: "6px 0" }}><Link href="/board" className="link">and {todo.length - 6} more on the board <ArrowRight size={12} /></Link></li> : null}
              {todo.length === 0 ? <li className="empty" style={{ padding: "10px 0" }}>Nothing waiting for a check-in prep.</li> : null}
            </ul>
            <span className="over">Waiting on repairs · {repairs.length}</span>
            <ul className="list">
              {repairs.slice(0, 6).map((r) => (
                <li key={r.apartment.name}>
                  <Link href={`/board?apt=${encodeURIComponent(r.apartment.name)}`} className="row click" style={{ padding: "9px 0", textDecoration: "none", color: "inherit" }}>
                    <span className="stripe s-bad" />
                    <div className="m"><b>{r.apartment.name}</b><span>{r.flags.length ? r.flags.map((f) => `${f.item} ${f.problem.toLowerCase()}`).join(", ") : r.lastPrep ? `Not ready since ${whenText(r.lastPrep.at)}` : "Problem reported"}</span></div>
                    <span className="age">{aptShort(r.apartment)}</span>
                    <Badge tone="bad">{plural(r.flags.length, "flag")}</Badge>
                  </Link>
                </li>
              ))}
              {repairs.length === 0 ? <li className="empty" style={{ padding: "10px 0" }}>Nothing waiting on repairs.</li> : null}
            </ul>
            {inspecting.length ? (
              <div className="hstack"><span className="over">Inspecting now</span>{inspecting.map((r) => <span key={r.apartment.name} className="badge t-info"><span className="d" />{r.apartment.name} · {r.draft!.prepared_by_name}</span>)}</div>
            ) : null}
          </div>
        </section>

        <div className="vstack" style={{ gap: 18 }}>
          <LiveQueue items={queue} />
          <section className="card">
            <div className="card-h"><h3>Today’s tasks</h3><span className="sp" /><Link href="/tasks" className="link">All tasks <ArrowRight size={13} /></Link></div>
            <ul className="list">
              {liveTasks.slice(0, 6).map((t) => (
                <li key={t.id} className="row">
                  <span className="mono" style={{ fontSize: 12, width: 44, color: t.state === "overdue" ? "var(--bad-fg)" : "var(--text-3)" }}>{t.due_time || "—"}</span>
                  <div className="m"><b style={t.status === "Done" ? { textDecoration: "line-through", color: "var(--text-3)" } : undefined}>{t.description}</b><span>{t.apartment ? `${t.apartment} · ` : ""}{t.assigned_to || "Anyone on duty"}</span></div>
                  {t.status === "Done" ? <Badge tone="ok" dot={false}>Done</Badge> : t.state === "overdue" ? <Badge tone="bad">Overdue</Badge> : <Badge tone="neu" dot={false}>To do</Badge>}
                </li>
              ))}
              {liveTasks.length === 0 ? <li className="empty">No tasks for today. <Link href="/tasks" className="link"><Plus size={12} /> Add one</Link></li> : null}
            </ul>
          </section>
        </div>
      </div>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Check-in preps · last 14 days</h3><span className="sp" /><div className="legend"><span><i style={{ background: "var(--ok)" }} />Ready</span><span><i style={{ background: "var(--bad)" }} />Not ready</span></div></div>
          <div className="card-b">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Check-in preps submitted per day for the last 14 days">
              {[0, Math.round(max / 2), max].map((v) => { const y = H - B - (v / max) * (H - B - 10); return <g key={v}><line className="chart-grid" x1={L} x2={W} y1={y} y2={y} /><text className="chart-axis" x={L - 8} y={y + 3} textAnchor="end">{v}</text></g>; })}
              {perDay.map((p, i) => {
                const x = L + i * bw + 5, w = bw - 10, y0 = H - B, hr = (p.ready / max) * (H - B - 10), hn = (p.not / max) * (H - B - 10);
                const label = new Date(p.d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                return (
                  <g key={p.d}>
                    <title>{`${label}: ${p.ready} ready, ${p.not} not ready`}</title>
                    {hr ? <rect x={x} y={y0 - hr} width={w} height={hr} rx="3" fill="var(--ok)" opacity={i === 13 ? 1 : 0.8} /> : null}
                    {hn ? <rect x={x} y={y0 - hr - hn - (hr ? 2 : 0)} width={w} height={hn} rx="3" fill="var(--bad)" opacity={i === 13 ? 1 : 0.8} /> : null}
                    {i % 2 === 1 || i === 13 ? <text className="chart-axis" x={x + w / 2} y={H - 6} textAnchor="middle">{i === 13 ? "Today" : label}</text> : null}
                  </g>
                );
              })}
            </svg>
            <div className="hint" style={{ marginTop: 6 }}>Today: {perDay[13].ready} ready, {perDay[13].not} not ready so far.</div>
          </div>
        </section>
        <section className="card">
          <div className="card-h"><h3>Activity</h3><span className="sp" /><span className="sub">everything is signed and timestamped</span></div>
          <ul className="tl">
            {activity.map((a, i) => { const Icon = ACT_ICON[a.icon as keyof typeof ACT_ICON]; return <li key={i}><span className="tm">{lagosDayKey(a.at) === lagosDayKey(new Date().toISOString()) ? clockTime(a.at) : dayText(a.at).split(" ").slice(1).join(" ")}</span><span className="dt"><Icon size={11} strokeWidth={2} /></span><span className="tx">{a.text}</span></li>; })}
            {activity.length === 0 ? <li className="empty" style={{ display: "block" }}>Nothing yet.</li> : null}
          </ul>
        </section>
      </div>
    </>
  );
}
