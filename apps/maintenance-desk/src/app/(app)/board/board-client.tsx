"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Filter, Inbox, MapPin, Paperclip, Search, UserRound, Wrench } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, priTone } from "@/components/suite";
import { JobDrawer, type Me } from "@/components/job-drawer";
import { PRI_RANK, type JobView } from "@/lib/jobs";
import { MD_UNITS, formatNaira as naira } from "@/lib/types";
import { shortName } from "@/lib/time";

const COLS: { status: JobView["status"]; label: string; tone: string }[] = [
  { status: "Reported", label: "Reported", tone: "warn" },
  { status: "In Progress", label: "In progress", tone: "info" },
  { status: "Resolved", label: "Resolved today", tone: "ok" },
];

export function BoardClient({
  jobs,
  team,
  me,
  canManage,
  canMoney,
  canWorkAny,
  initialId,
  initialUnit,
}: {
  jobs: JobView[];
  team: Record<string, string[]>;
  me: Me;
  canManage: boolean;
  canMoney: boolean;
  canWorkAny: boolean;
  initialId: string | null;
  initialUnit: string;
}) {
  const router = useRouter();
  const [unit, setUnit] = useState(initialUnit);
  const [q, setQ] = useState("");
  const [highOnly, setHighOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(initialId);

  // Keep the open job in the address, so a link or a refresh lands on it.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) url.searchParams.set("id", openId); else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
  }, [openId]);

  const live = jobs.filter((j) => j.status !== "Resolved" || j.resolvedToday);
  const needUnit = jobs.filter((j) => j.needsUnit && j.status !== "Resolved");
  const s = q.trim().toLowerCase();
  const shown = live.filter(
    (j) =>
      (unit === "all" || (unit === "needs" ? j.needsUnit : j.unit === unit)) &&
      (!highOnly || j.priority === "High") &&
      (!s || `${j.ref} ${j.title} ${j.area} ${j.unit} ${j.startedBy ?? ""} ${j.resolvedBy ?? ""}`.toLowerCase().includes(s))
  );
  const count = (u: string) => live.filter((j) => j.status !== "Resolved" && (u === "all" || j.unit === u)).length;
  const open = jobs.find((j) => j.id === openId) ?? null;

  const card = (j: JobView) => (
    <button key={j.id} type="button" className={`tcard ${openId === j.id ? "sel" : ""}`} onClick={() => setOpenId(j.id)}>
      <span className={`rl s-${priTone(j.priority)}`} />
      <span className="bd">
        <span className="hstack" style={{ justifyContent: "space-between" }}>
          <span className="mono muted" style={{ fontSize: 12 }}>{j.ref} · {j.age}</span>
          <Badge tone={priTone(j.priority)}>{j.priority}</Badge>
        </span>
        <span className="t">{j.title}</span>
        <span className="meta"><MapPin size={14} /><span>{j.area} · {j.needsUnit ? <b style={{ color: "var(--warn-fg)" }}>needs a unit</b> : j.unit}</span></span>
        {j.status === "Resolved" && j.resolvedBy ? <span className="meta fix-line"><CheckCircle2 size={14} /><span>Fixed by {j.resolvedBy}{j.resolvedWhen ? ` · ${j.resolvedWhen.replace(/^Today /, "")}` : ""}</span></span>
          : j.status === "In Progress" && j.startedBy ? <span className="meta"><UserRound size={14} /><span>{shortName(j.startedBy)} · since {j.startedWhen?.replace(/^Today /, "")}</span></span> : null}
        <span className="ft">
          {j.source === "checklist" ? <span className="src dd"><ClipboardCheck size={12} /> Check-in prep</span> : <span className="src dd">{j.fromLabel}</span>}
          {j.photoCount ? <span><Paperclip size={12} style={{ verticalAlign: "-2px" }} /> {j.photoCount}</span> : null}
          <span style={{ flex: 1 }} />
          {canMoney && j.cost ? <span className="mono">{naira(j.cost)}</span> : null}
        </span>
      </span>
    </button>
  );

  return (
    <>
      <div className="phead">
        <div className="t"><h1>Ticket Board</h1><p>Jobs from Duty Desk: items flagged in a check-in prep, problems Resident Officers report, guest complaints and tickets they log. Anything else is on the Requests page.</p></div>
        <div className="acts"><AutoRefresh /><Link href="/requests" className="btn btn-secondary"><Inbox size={15} /> Requests</Link></div>
      </div>

      {needUnit.length ? (
        <div className="pill-note t-warn">
          <Wrench size={16} />
          <span>{needUnit.length} older job{needUnit.length > 1 ? "s were" : " was"} filed under “Engineering” before the units existed. {canManage ? <>Open {needUnit.length > 1 ? "each one" : "it"} and choose its unit. <button type="button" className="link" onClick={() => setUnit("needs")}>Show {needUnit.length > 1 ? "them" : "it"}</button></> : "The Manager or Supervisor will choose the units."}</span>
        </div>
      ) : null}

      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div className="seg seg-units" role="group" aria-label="Unit">
          {["all", ...MD_UNITS].map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u === "all" ? "All units" : u}{me.unit === u ? " (yours)" : ""} <span className="ct">{count(u)}</span></button>
          ))}
          {needUnit.length ? <button type="button" aria-pressed={unit === "needs"} onClick={() => setUnit("needs")}>Needs a unit <span className="ct">{needUnit.length}</span></button> : null}
        </div>
        <div className="hstack">
          <div className="input-wrap" style={{ width: 240, maxWidth: "100%" }}><Search size={15} /><input className="input" style={{ height: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs" aria-label="Search jobs" /></div>
          <button type="button" className="btn btn-secondary btn-sm" aria-pressed={highOnly} onClick={() => setHighOnly((v) => !v)} style={highOnly ? { borderColor: "var(--bad)", color: "var(--bad-fg)" } : undefined}><Filter size={14} /> High priority</button>
        </div>
      </div>

      <div className="kanban-wrap">
        <div className="kanban">
          {COLS.map((c) => {
            const items = shown.filter((j) => j.status === c.status).sort((a, b) => (c.status === "Resolved" ? (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "") : PRI_RANK[a.priority] - PRI_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt)));
            const sum = items.reduce((a, j) => a + j.cost, 0);
            return (
              <section key={c.status} className="col" aria-label={c.label}>
                <div className="col-h"><span className={`badge t-${c.tone}`} style={{ height: 8, width: 8, padding: 0 }} />{c.label}<span className="ct">{items.length}</span><span className="sp" />{canMoney && sum ? <span className="mono muted" style={{ fontWeight: 400, fontSize: 12 }}>{naira(sum)}</span> : null}</div>
                {items.map(card)}
                {items.length === 0 ? <div className="empty" style={{ padding: "18px 8px", fontSize: 13 }}>{c.status === "Resolved" ? "Nothing finished yet today." : "Nothing here."}</div> : null}
              </section>
            );
          })}
        </div>
      </div>

      <JobDrawer job={open} onClose={() => { setOpenId(null); router.refresh(); }} team={team} me={me} canManage={canManage} canMoney={canMoney} canWorkAny={canWorkAny} />
    </>
  );
}
