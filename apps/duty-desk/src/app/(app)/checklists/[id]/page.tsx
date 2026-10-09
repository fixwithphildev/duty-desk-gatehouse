import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, LayoutGrid, Lock, Wrench } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { getChecklistInProgressById, getChecklistWithItems } from "@/lib/data/checklists";
import { DD_CAN_EDIT_CHECKLISTS, DD_CAN_VOID } from "@/lib/types";
import { DD_CATEGORIES } from "@/lib/checklist-data";
import { aptWhere, findApartment } from "@/lib/apartments";
import { whenText } from "@/lib/time";
import { problemOf } from "@/lib/checklist-history";
import { Badge } from "@/components/suite";
import { AutoRefresh } from "@/components/auto-refresh";
import { VoidChecklistButton } from "./void-button";
import { ChecklistForm, type ItemValue } from "../new/checklist-form";
import { InspectionLock } from "../inspection-lock";

// Submitting from this page inserts any flagged-item tickets and up to ~84
// checklist items. That's normally under a second, but free-tier
// Supabase/Vercel cold starts can add several seconds, so allow up to 30s.
export const maxDuration = 30;

const typeLabel = (type: string) => (type === "check_in_prep" ? "Check-in prep" : "Check-out inspection");

export default async function ViewChecklistPage({ params }: { params: { id: string } }) {
  const session = await requirePageAccess("/checklists");
  const result = await getChecklistWithItems(params.id);
  if (!result) notFound();
  const { checklist, items } = result;
  const apt = findApartment(checklist.apartment);
  const name = apt?.name ?? checklist.apartment;
  const back = <Link href="/checklists" className="btn btn-ghost"><ChevronLeft size={15} /> Checklists</Link>;

  // Still in progress: your own checklist opens as the form, someone else's
  // shows who has it (and lets you take it over), and a stopped one says so.
  if (checklist.status === "in_progress") {
    const draft = checklist.void ? null : await getChecklistInProgressById(checklist.id);
    if (!draft) {
      return (
        <>
          <div className="phead"><div className="t"><span className="over">{typeLabel(checklist.type)}</span><h1>{name}: stopped before it was submitted</h1><p>Stopped by {checklist.voided_by_name ?? "—"}. The apartment keeps its last submitted status.</p></div><div className="acts">{back}</div></div>
        </>
      );
    }
    const canEdit = DD_CAN_EDIT_CHECKLISTS.includes(session.role);
    if (draft.prepared_by === session.staffId && canEdit) {
      const initialValues: Record<string, ItemValue> = {};
      for (const i of items) {
        initialValues[i.name] = {
          qty: i.qty ?? undefined,
          condition: i.condition ?? undefined,
          available: i.available === "Yes" || i.available === "No" ? i.available : undefined,
          note: i.note ?? undefined,
          dept: i.ticket_dept ?? undefined,
        };
      }
      return (
        <ChecklistForm
          id={draft.id}
          apartment={name}
          where={apt ? aptWhere(apt) : ""}
          initialType={draft.type}
          initialValues={initialValues}
          initialReady={checklist.draft_ready ?? null}
          preparedByName={session.displayName}
          startedAt={draft.started_at}
          savedAt={draft.updated_at}
          takenOverFrom={draft.taken_over_from_name && draft.taken_over_at ? { name: draft.taken_over_from_name, at: draft.taken_over_at } : null}
        />
      );
    }
    return (
      <>
        <div className="phead">
          <div className="t"><span className="over">{typeLabel(draft.type)} in progress</span><h1>{name}</h1>{apt ? <p>{aptWhere(apt)}</p> : null}</div>
          <div className="acts"><AutoRefresh />{back}</div>
        </div>
        <InspectionLock draft={draft} canTakeOver={canEdit} />
      </>
    );
  }

  const flagged = items.filter((i) => problemOf(i));
  const canVoid = DD_CAN_VOID.includes(session.role);
  const byCat = DD_CATEGORIES.map((c) => ({ c, list: items.filter((i) => c.items.includes(i.name)) })).filter((x) => x.list.length);
  const other = items.filter((i) => !DD_CATEGORIES.some((c) => c.items.includes(i.name)));
  const tone = (i: (typeof items)[number]) => (i.condition === "Good" || i.available === "Yes" ? "ok" : i.condition === "Damaged" || i.condition === "Missing" || i.available === "No" ? "bad" : "neu");

  return (
    <>
      <div className="phead">
        <div className="t">
          <span className="over">{typeLabel(checklist.type)} · {whenText(checklist.created_at)}</span>
          <h1>{name}</h1>
          <p>{apt ? `${aptWhere(apt)} · ` : ""}prepared by {checklist.prepared_by_name}{checklist.taken_over_from_name && checklist.taken_over_at ? ` (started by ${checklist.taken_over_from_name}${checklist.started_at ? ` at ${whenText(checklist.started_at)}` : ""}, taken over ${whenText(checklist.taken_over_at)})` : ""}</p>
        </div>
        <div className="acts">
          {apt ? <Link href={`/board?apt=${encodeURIComponent(apt.name)}`} className="btn btn-secondary"><LayoutGrid size={15} /> See it on the board</Link> : null}
          {back}
        </div>
      </div>

      {checklist.void ? (
        <div className="err-note"><Lock size={16} /><span><b>Voided</b> by {checklist.voided_by_name}: {checklist.void_reason}. It no longer counts towards the apartment’s status.</span></div>
      ) : null}

      <section className="card">
        <div className="locked">
          <div className="seal"><Lock size={26} /></div>
          <h2 style={{ margin: 0, fontSize: 22 }}>{name} submitted as {checklist.overall_ready ? "Ready" : "Not ready"}</h2>
          <p className="muted" style={{ margin: 0, maxWidth: "56ch" }}>
            Signed by {checklist.prepared_by_name}, {whenText(checklist.created_at)}. {flagged.length ? `${flagged.length} item${flagged.length > 1 ? "s were" : " was"} flagged and sent to maintenance.` : "Nothing was flagged."} Locked records can only be voided by a Supervisor or a manager, with a reason.
          </p>
          <div className="hstack" style={{ justifyContent: "center" }}>
            <Badge tone={checklist.overall_ready ? "ok" : "bad"}>{checklist.overall_ready ? "Ready" : "Not ready"}</Badge>
            {!checklist.void ? <VoidChecklistButton id={checklist.id} apartment={name} canEdit={canVoid} /> : null}
          </div>
        </div>
      </section>

      {flagged.length ? (
        <section className="card">
          <div className="card-h"><h3>Flagged items</h3><span className="sp" /><Badge tone="bad">{flagged.length}</Badge></div>
          <ul className="list">
            {flagged.map((i) => (
              <li key={i.id} className="row">
                <span className="stripe s-bad" />
                <div className="m"><b>{i.name}</b><span>{i.category}{i.ticket_dept ? ` · sent to ${i.ticket_dept}` : ""}{i.note ? ` · “${i.note}”` : ""}</span></div>
                {i.linked_ticket_id ? <Link href={`/maintenance?id=${i.linked_ticket_id}`} className="btn btn-ghost btn-sm"><Wrench size={13} /> Ticket</Link> : null}
                <Badge tone="bad">{problemOf(i)}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="g g-2">
        {[...byCat, ...(other.length ? [{ c: { key: "other", label: "Other", items: [] as string[] }, list: other }] : [])].map(({ c, list }) => (
          <section key={c.key} className="card">
            <div className="card-h"><h3>{c.label}</h3><span className="sp" /><span className="sub">{list.length} checks</span></div>
            <ul className="list">
              {list.map((i) => (
                <li key={i.id} className="row" style={{ padding: "8px 20px" }}>
                  <div className="m"><b style={{ fontWeight: 400 }}>{i.name}{i.qty ? <span className="mono muted"> · {i.qty}</span> : null}</b></div>
                  <Badge tone={tone(i)} dot={false}>{i.condition ?? i.available ?? "—"}</Badge>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
