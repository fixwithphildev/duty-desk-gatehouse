"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Search, DoorOpen, DoorClosed, ClipboardCheck, History, Users, KeyRound, LogOut, Wrench } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { StartPrepButton } from "@/components/start-prep-button";
import { CheckInDrawer, CheckOutDrawer, MaintenanceDrawer } from "@/components/stay-drawers";
import { ReasonList } from "@/components/reason-list";
import { MAIN_FLOORS, STUDIO_FLOORS, WINGS, suggestApartments, findApartment } from "@/lib/apartments";
import type { BoardApt } from "@/lib/board";
import { STATUS_TONE, isTodo, todoRank, type ReadyStatus } from "@/lib/status";

type Filter = "all" | ReadyStatus;
type Bld = "both" | "main" | "studio";

const FILTERS: [Filter, string][] = [["all", "All"], ["ready", "Ready to sell"], ["recheck", "Re-check"], ["maintenance", "Under maintenance"], ["repaired", "Repairs done"], ["notready", "Not ready"], ["unchecked", "Needs checklist"], ["inspecting", "Inspecting"], ["occupied", "Occupied"]];

type Act = { kind: "in" | "out" | "maint"; apt: BoardApt } | null;

export type AptTask = { id: string; description: string; who: string; due: string | null; overdue: boolean };

export function BoardClient({ apts, openTasks, canPrep, canStay, canReport, ticketLinks, initialApt, readyDays, totalChecks }: { apts: BoardApt[]; openTasks: Record<string, AptTask[]>; canPrep: boolean; canStay: boolean; canReport: boolean; ticketLinks: boolean; initialApt: string; readyDays: number; totalChecks: number }) {
  const [act, setAct] = useState<Act>(null);
  const [q, setQ] = useState(initialApt);
  const [focus, setFocus] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [bld, setBld] = useState<Bld>("both");
  const byName = useMemo(() => new Map(apts.map((a) => [a.name, a])), [apts]);
  const isMain = (a: BoardApt) => a.building === "Main Building";
  const count = (f: Filter, list = apts) => (f === "all" ? list.length : list.filter((a) => a.status === f).length);
  const todo = apts.filter((a) => isTodo(a.status)).sort((a, b) => todoRank(a.status) - todoRank(b.status) || a.name.localeCompare(b.name));
  const leaving = apts.filter((a) => a.stay?.leavesToday).sort((a, b) => a.name.localeCompare(b.name));
  const mine = apts.find((a) => a.draft?.mine);
  const headStart = mine ?? todo[0];

  const typed = q.trim();
  const found = findApartment(typed);
  const selected = found ? byName.get(found.name) : undefined;
  const sugg = typed && !found ? suggestApartments(typed) : [];

  useEffect(() => { if (initialApt) document.getElementById("board-lookup")?.scrollIntoView({ block: "center" }); }, [initialApt]);

  const pick = (name: string) => { setQ(name); setFocus(false); document.getElementById("board-lookup")?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  const tile = (name: string) => {
    const a = byName.get(name);
    if (!a) return <div key={name} className="tile-gap" />;
    if (filter !== "all" && a.status !== filter) return <div key={name} className="tile-gap" />;
    return (
      <button key={name} type="button" className={`tile ${a.status} ${selected?.name === name ? "sel" : ""}`} onClick={() => pick(name)} title={`${name} · ${a.where}`} aria-label={`${name}: ${a.label}`}>
        <div className="u"><span>{name}</span><i /></div>
        {/* "Under maintenance" doesn't fit a tile on small phones or laptops; the lookup says it in full. */}
        <div><div className="st">{a.status === "maintenance" ? "Maintenance" : a.label}</div><div className="mt">{a.meta}</div></div>
      </button>
    );
  };

  const head = (title: string, sub: string, list: BoardApt[]) => (
    <div className="card-h">
      <h3>{title}</h3><span className="sub">{sub}</span><span className="sp" />
      <span className="badge t-ok"><span className="d" />{count("ready", list)} ready to sell</span>
      {count("recheck", list) ? <span className="badge t-warn"><span className="d" />{count("recheck", list)} re-check</span> : null}
      {count("maintenance", list) ? <span className="badge t-maint"><span className="d" />{count("maintenance", list)} under maintenance</span> : null}
      {count("repaired", list) ? <span className="badge t-maint">{count("repaired", list)} repairs done</span> : null}
      {count("notready", list) ? <span className="badge t-bad"><span className="d" />{count("notready", list)} not ready</span> : null}
      {count("unchecked", list) ? <span className="badge t-neu">{count("unchecked", list)} need checklist</span> : null}
      {count("occupied", list) ? <span className="badge t-neu">{count("occupied", list)} occupied</span> : null}
    </div>
  );

  const mainApts = apts.filter(isMain), studioApts = apts.filter((a) => !isMain(a));
  const floorOf = (list: BoardApt[], f: string) => list.filter((a) => a.floor === f);

  return (
    <>
      <div className="phead">
        <div className="t">
          <h1>Readiness Board</h1>
          <p>Front desk may only sell apartments that are green. A Ready check-in prep lasts {readyDays} days; after that the apartment needs checking again.</p>
        </div>
        <div className="acts">
          <AutoRefresh />
          {canPrep && headStart ? <StartPrepButton apartment={headStart.name} draft={headStart.draft} primary small={false} label={`Start check-in prep · ${headStart.name}`} /> : null}
        </div>
      </div>

      <div className="g todo-grid">
        <section className="card">
          <div className="card-h">
            <h3>{canPrep ? "Your to-do" : "Officers’ to-do"}</h3><span className="sp" />
            {leaving.length ? <span className="badge t-info"><span className="d" />{leaving.length} check-out{leaving.length === 1 ? "" : "s"}</span> : null}
            <span className="badge t-warn"><span className="d" />{todo.length} check-in prep{todo.length === 1 ? "" : "s"}</span>
          </div>
          {leaving.length ? (
            <div className="todo-sec">
              <span className="over">Check-outs today · {leaving.length}</span>
              <ul className="list">
                {leaving.map((a) => (
                  <li key={a.name} className="row" style={{ padding: "10px 0" }}>
                    <span className="stripe s-info" />
                    <div className="m"><b>{a.name}</b><span>{a.stay!.guest} · {a.short}</span></div>
                    {canStay ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAct({ kind: "out", apt: a })}><LogOut size={14} /> Record check-out</button> : <span className="badge t-neu">Leaves today</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="todo-sec">
            <span className="over">Check-in preps to do · {todo.length}</span>
            <ul className="list">
              {todo.length === 0 ? <li className="empty">Nothing waiting for a check-in prep.</li> : null}
              {todo.map((a) => (
                <li key={a.name} className="row" style={{ padding: "10px 0" }}>
                  <span className={`stripe s-${STATUS_TONE[a.status]}`} />
                  <div className="m"><b>{a.name}</b><span>{a.status === "repaired" ? "Repairs done" : a.meta} · {a.short}</span></div>
                  {canPrep ? <StartPrepButton apartment={a.name} draft={a.draft} /> : <span className={`badge t-${STATUS_TONE[a.status]}`}>{a.label}</span>}
                </li>
              ))}
            </ul>
          </div>
          <p className="hint" style={{ padding: "10px 20px 16px", margin: 0 }}>Green apartments need nothing from you until they’re sold. Purple ones are under maintenance; when the repairs are done they come onto this list for a new check-in prep.</p>
        </section>

        <section className="card gate v" id="board-lookup">
          <div className="q">
            <span className="over">Look up an apartment</span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Can it be sold?</h3>
            <div className="gsearch">
              <div className="input-wrap">
                <Search size={20} />
                <input
                  className="input big"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onFocus={() => setFocus(true)}
                  onBlur={() => setTimeout(() => setFocus(false), 150)}
                  placeholder="Start typing a name, e.g. Lisbon"
                  aria-label="Apartment name"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={focus && sugg.length > 0}
                  aria-controls="board-sugg"
                />
              </div>
              {focus && typed && !found ? (
                <div className="sugg" id="board-sugg" role="listbox" aria-label="Matching apartments">
                  {sugg.length ? sugg.map((s) => (
                    <button key={s.name} type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s.name)}>
                      <b>{s.name}</b><span>{byName.get(s.name)?.where}</span>
                    </button>
                  )) : <div className="empty" style={{ padding: 12 }}>No apartment matches “{typed}”.</div>}
                </div>
              ) : null}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <LookupResult a={selected} tasks={selected ? openTasks[selected.name] ?? [] : []} typed={typed} matches={sugg.length} canPrep={canPrep} canStay={canStay} canReport={canReport} ticketLinks={ticketLinks} onAct={(kind, apt) => setAct({ kind, apt })} readyDays={readyDays} totalChecks={totalChecks} />
          </div>
        </section>
      </div>

      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div className="seg" role="group" aria-label="Filter by status">
          {FILTERS.map(([f, l]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{l} <span className="ct">{count(f)}</span></button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Building">
          {([["both", "Both", ""], ["main", "Main Building", mainApts.length], ["studio", "Studio Wings", studioApts.length]] as [Bld, string, number | ""][]).map(([k, l, n]) => (
            <button key={k} type="button" aria-pressed={bld === k} onClick={() => setBld(k)}>{l}{n !== "" ? <span className="ct">{n}</span> : null}</button>
          ))}
        </div>
      </div>

      {bld !== "studio" ? (
        <section className="card">
          {head("Main Building", `${mainApts.length} · floors G–7`, mainApts)}
          <div className="floors">
            {MAIN_FLOORS.map((f) => {
              const list = floorOf(mainApts, f);
              return (
                <div key={f} className="floor f8">
                  <div className="fl">{f === "G" ? "G" : `L${f}`}</div>
                  {list.map((a) => tile(a.name))}
                  {Array.from({ length: Math.max(0, 8 - list.length) }, (_, i) => <div key={`gap-${i}`} className="tile-gap empty" />)}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {bld !== "main" ? (
        <section className="card">
          {head("Studio Wings", `${studioApts.length} studios · 4 wings`, studioApts)}
          <div className="floors">
            <div className="srow shead"><div />{WINGS.map((w) => <div key={w} className="wh">{w}</div>)}</div>
            {STUDIO_FLOORS.map((f) => (
              <div key={f} className="srow">
                <div className="fl">L{f}</div>
                {WINGS.map((w) => {
                  const list = studioApts.filter((a) => a.floor === f && a.building === w);
                  return (
                    <div key={w} className="wing" data-w={w}>
                      {list.map((a) => tile(a.name))}
                      {Array.from({ length: Math.max(0, 2 - list.length) }, (_, i) => <div key={`gap-${i}`} className="tile-gap empty" />)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="hint" style={{ padding: "0 20px 16px", margin: 0 }}>Studios use the same {totalChecks}-check check-in prep as the main building.</p>
        </section>
      ) : null}

      <CheckInDrawer open={act?.kind === "in"} onClose={() => setAct(null)} apartment={act?.kind === "in" ? { name: act.apt.name, where: act.apt.where } : null} readyApts={[]} />
      <CheckOutDrawer open={act?.kind === "out"} onClose={() => setAct(null)} stay={act?.kind === "out" && act.apt.stay ? { id: act.apt.stay.id, guest: act.apt.stay.guest, apartment: act.apt.name, where: act.apt.where } : null} />
      <MaintenanceDrawer open={act?.kind === "maint"} onClose={() => setAct(null)} apartment={act?.kind === "maint" ? { name: act.apt.name, where: act.apt.where } : null} mode={act?.apt.status === "occupied" ? "occupied" : act?.apt.status === "maintenance" ? "add" : "put"} />
    </>
  );
}

function LookupResult({ a, tasks, typed, matches, canPrep, canStay, canReport, ticketLinks, onAct, readyDays, totalChecks }: { a: BoardApt | undefined; tasks: AptTask[]; typed: string; matches: number; canPrep: boolean; canStay: boolean; canReport: boolean; ticketLinks: boolean; onAct: (kind: "in" | "out" | "maint", a: BoardApt) => void; readyDays: number; totalChecks: number }) {
  if (!typed) {
    return (
      <div className="res neu">
        <div className="ri"><Search size={24} /></div>
        <div><div className="verdict muted">Look up an apartment</div><h3>Type the apartment name</h3><p className="muted" style={{ margin: 0 }}>See whether front desk can sell it, and why not.</p></div>
      </div>
    );
  }
  if (!a) {
    return (
      <div className="res neu">
        <div className="ri"><Search size={24} /></div>
        <div>
          <div className="verdict muted">{matches ? "Pick from the list" : "Not found"}</div>
          <h3>{matches ? `${matches} apartment${matches > 1 ? "s" : ""} match “${typed}”` : `No apartment called “${typed}”`}</h3>
          <p className="muted" style={{ margin: 0 }}>Choose the apartment from the suggestions under the search box.</p>
        </div>
      </div>
    );
  }
  const where = <span style={{ fontSize: 13, color: "var(--text-2)" }}>{a.where}</span>;
  const history = a.lastPrepId ? <Link href={`/checklists/${a.lastPrepId}`} className="btn btn-ghost btn-sm"><History size={14} /> Last check-in prep</Link> : null;
  const start = (label?: string) => (canPrep ? <StartPrepButton apartment={a.name} draft={a.draft} label={label} /> : null);
  const tone = { ready: "ok", notready: "bad", maintenance: "maint", repaired: "maint" } as Record<string, string>;
  const Icon = a.status === "ready" ? DoorOpen : a.status === "occupied" ? Users : a.status === "maintenance" || a.status === "repaired" ? Wrench : a.status === "inspecting" || a.status === "unchecked" ? ClipboardCheck : DoorClosed;
  const style: Record<string, { bg?: string; ri?: CSSProperties; verdict?: string }> = {
    recheck: { bg: "var(--warn-bg)", ri: { background: "var(--warn)", color: "#1B1A17" }, verdict: "var(--warn-fg)" },
    inspecting: { bg: "var(--info-bg)", ri: { background: "var(--info)", color: "#fff" }, verdict: "var(--info-fg)" },
  };
  const s = style[a.status] ?? {};
  const verdict = {
    ready: "Ready to sell",
    recheck: "Re-check due · don’t sell yet",
    maintenance: "Under maintenance · don’t sell",
    repaired: "Repairs done · check it before selling",
    notready: `Not ready · don’t sell`,
    inspecting: "Being checked now · don’t sell yet",
    unchecked: "Needs checklist · don’t sell yet",
    occupied: "Occupied",
  }[a.status];
  return (
    <div className={`res ${tone[a.status] ?? "neu"}`} style={s.bg ? { background: s.bg } : undefined}>
      <div className="ri" style={s.ri}><Icon size={26} /></div>
      <div className="vstack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
        <div className={`verdict ${tone[a.status] ? "" : "muted"}`} style={s.verdict ? { color: s.verdict } : undefined}>{verdict}</div>
        <h3>{a.name}{a.reasons.length && (a.status === "maintenance" || a.status === "repaired") ? ` · ${a.reasons.length} reason${a.reasons.length > 1 ? "s" : ""}` : ""}</h3>
        {where}
        <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>{a.detail}</span>
        {a.reasons.length ? (
          <div className="vstack" style={{ gap: 6, marginTop: 8 }}>
            <span className="over">{a.status === "maintenance" ? "Why it’s under maintenance" : a.status === "repaired" ? "What was repaired" : a.status === "occupied" ? "Problems reported during the stay" : "Problems reported"}</span>
            <ReasonList reasons={a.reasons} links={ticketLinks} occupied={a.status === "occupied"} />
          </div>
        ) : null}
        {tasks.length ? (
          <div className="vstack" style={{ gap: 6, marginTop: 8 }}>
            <span className="over">Open tasks for {a.name}</span>
            {tasks.map((t) => (
              <Link key={t.id} href="/tasks" className="hstack" style={{ fontSize: 13, textDecoration: "none", color: "inherit" }}>
                <span className={`badge ${t.overdue ? "t-bad" : "t-info"}`}><span className="d" />{t.overdue ? "Overdue" : t.due ?? "Task"}</span>
                <b style={{ fontWeight: 500 }}>{t.description}</b>
                <span className="muted">{t.who}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="hstack" style={{ marginTop: 8 }}>
          {a.status === "ready" && canStay ? <button type="button" className="btn btn-primary btn-sm" onClick={() => onAct("in", a)}><KeyRound size={14} /> Record check-in</button> : null}
          {a.status === "occupied" && canStay && a.stay ? <button type="button" className="btn btn-primary btn-sm" onClick={() => onAct("out", a)}><LogOut size={14} /> Record check-out</button> : null}
          {a.status === "ready" ? start("Check again") : a.status === "occupied" ? null : start()}
          {canReport && a.status !== "inspecting" ? <button type="button" className={`btn btn-sm ${a.status === "maintenance" ? "btn-secondary" : "btn-ghost"}`} onClick={() => onAct("maint", a)}><Wrench size={14} /> {a.status === "maintenance" ? "Add a reason" : a.status === "occupied" ? "Report a problem" : "Put under maintenance"}</button> : null}
          {history}
        </div>
        {a.status === "ready" ? <span className="hint">Ready lasts {readyDays} days from the check-in prep. Every apartment uses the same {totalChecks} checks.</span> : null}
      </div>
    </div>
  );
}
