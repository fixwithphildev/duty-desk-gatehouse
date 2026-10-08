import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { getAllChecklists, getChecklistsInProgress } from "@/lib/data/checklists";
import { getReadiness, todoList } from "@/lib/data/readiness";
import { aptShort, findApartment } from "@/lib/apartments";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import { whenText, clockTime } from "@/lib/time";
import { AutoRefresh } from "@/components/auto-refresh";
import { StartPrepButton } from "@/components/start-prep-button";
import { PageHead } from "@/components/suite";
import { HistoryTable, type HistoryRow } from "./history-table";

export default async function ChecklistsPage({ searchParams }: { searchParams: { apt?: string } }) {
  const session = await requirePageAccess("/checklists");
  const [all, inProgress, readiness] = await Promise.all([getAllChecklists(), getChecklistsInProgress(), getReadiness()]);
  const canCreate = DD_CAN_EDIT_CHECKLISTS.includes(session.role);
  const total = DD_ALL_ITEMS.length;
  const mine = inProgress.filter((c) => c.prepared_by === session.staffId);
  const others = inProgress.filter((c) => c.prepared_by !== session.staffId);
  const todo = todoList(readiness).filter((r) => !r.draft);
  const history: HistoryRow[] = all.map((c) => ({
    id: c.id,
    apartment: findApartment(c.apartment)?.name ?? c.apartment,
    type: c.type === "check_in_prep" ? "Check-in prep" : "Check-out inspection",
    by: c.prepared_by_name,
    when: whenText(c.created_at),
    ready: c.overall_ready,
    void: c.void,
  }));

  return (
    <>
      <PageHead title="Checklists" sub="Check-in preps decide whether front desk can sell an apartment. Every answer is saved as you go, so everyone can see what’s being inspected.">
        <AutoRefresh />
        {canCreate ? <Link href="/checklists/new" className="btn btn-primary"><Plus size={15} /> New checklist</Link> : null}
      </PageHead>

      <div className="g g-2">
        <section className="card">
          <div className="card-h"><h3>Your to-do</h3><span className="sp" /><span className="badge t-warn"><span className="d" />{mine.length + todo.length} apartment{mine.length + todo.length === 1 ? "" : "s"}</span></div>
          <ul className="list">
            {mine.map((c) => (
              <li key={c.id} className="row">
                <span className="stripe s-info" />
                <div className="m"><b>{findApartment(c.apartment)?.name ?? c.apartment}</b><span>You started at {clockTime(c.started_at)} · {c.answered}/{total} · saved {clockTime(c.updated_at)}</span></div>
                <Link href={`/checklists/${c.id}`} className="btn btn-secondary btn-sm">Continue</Link>
              </li>
            ))}
            {todo.slice(0, 8).map((r) => (
              <li key={r.apartment.name} className="row">
                <span className={`stripe ${r.status === "recheck" ? "s-warn" : "s-neu"}`} />
                <div className="m"><b>{r.apartment.name}</b><span>{r.status === "recheck" ? "Ready check expired, still unsold" : r.lastCheckout ? `Guest checked out ${whenText(r.lastCheckout.at)}` : "No check-in prep yet"} · {aptShort(r.apartment)}</span></div>
                {canCreate ? <StartPrepButton apartment={r.apartment.name} draft={null} /> : null}
              </li>
            ))}
            {mine.length + todo.length === 0 ? <li className="empty">Nothing to inspect right now.</li> : null}
          </ul>
          {todo.length > 8 ? <div style={{ padding: "10px 20px 14px" }}><Link href="/board" className="link">See all {todo.length} on the Readiness Board</Link></div> : null}
        </section>
        <section className="card">
          <div className="card-h"><h3>Being inspected by others</h3><span className="sp" /><span className="sub">{others.length} in progress</span></div>
          <ul className="list">
            {others.map((c) => (
              <li key={c.id}>
                <Link href={`/checklists/${c.id}`} className="row click" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="stripe s-info" />
                  <div className="m"><b>{findApartment(c.apartment)?.name ?? c.apartment}</b><span>{c.prepared_by_name} started at {clockTime(c.started_at)} · {c.answered} of {total} checks done · saved {clockTime(c.updated_at)}</span></div>
                  <span className="badge t-info"><span className="d" />In progress</span>
                </Link>
              </li>
            ))}
            {others.length === 0 ? <li className="empty">No one else is inspecting right now.</li> : null}
          </ul>
        </section>
      </div>

      <HistoryTable rows={history} initialQuery={searchParams.apt ?? ""} />
    </>
  );
}
