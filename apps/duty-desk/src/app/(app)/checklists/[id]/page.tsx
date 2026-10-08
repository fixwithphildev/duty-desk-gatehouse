import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { getChecklistInProgressById, getChecklistWithItems } from "@/lib/data/checklists";
import { DD_CAN_EDIT_CHECKLISTS, DD_CAN_VOID } from "@/lib/types";
import { Badge } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { VoidChecklistButton } from "./void-button";
import { ChecklistForm, type ItemValue } from "../new/checklist-form";
import { InspectionLock } from "../inspection-lock";

// Submitting from this page inserts any flagged-item tickets and up to ~84
// checklist items. That's normally under a second, but free-tier
// Supabase/Vercel cold starts can add several seconds, so allow up to 30s.
export const maxDuration = 30;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function checklistTypeLabel(type: string): string {
  return type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection";
}

export default async function ViewChecklistPage({ params }: { params: { id: string } }) {
  const session = await requirePageAccess("/checklists");
  const result = await getChecklistWithItems(params.id);
  if (!result) notFound();
  const { checklist, items } = result;

  // Still in progress: your own checklist opens as the form, someone else's
  // shows who has it (and lets you take it over), and a stopped one says so.
  if (checklist.status === "in_progress") {
    const back = <Link href="/checklists" className="btn btn-ghost"><ChevronLeft size={14} /> Back</Link>;
    const draft = checklist.void ? null : await getChecklistInProgressById(checklist.id);
    if (!draft) {
      return (
        <div className="view">
          <div className="view-head">{back}</div>
          <div className="handover-banner">
            <div className="handover-main">
              <div className="handover-title">Apartment {checklist.apartment}: this checklist was stopped before it was submitted</div>
              <div className="handover-note">By {checklist.voided_by_name ?? "—"}. The apartment keeps its last submitted status.</div>
            </div>
          </div>
        </div>
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
        };
      }
      return (
        <ChecklistForm
          id={draft.id}
          apartment={draft.apartment}
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
      <div className="view">
        <div className="view-head">{back}<AutoRefresh /></div>
        <InspectionLock draft={draft} canTakeOver={canEdit} />
      </div>
    );
  }
  const flagged = items.filter((i) => i.condition === "Damaged" || i.condition === "Missing");
  const canVoid = DD_CAN_VOID.includes(session.role);

  return (
    <div className="view">
      <div className="view-head">
        <Link href="/checklists" className="btn btn-ghost"><ChevronLeft size={14} /> Back</Link>
      </div>

      {checklist.void ? (
        <div className="handover-banner">
          <div className="handover-main">
            <div className="handover-title">This checklist has been voided</div>
            <div className="handover-note">By {checklist.voided_by_name} — {checklist.void_reason}</div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="view-checklist-head">
          <div>
            <h2>Apartment {checklist.apartment}</h2>
            <div className="mono cell-sub">
              {checklistTypeLabel(checklist.type)} · prepared by {checklist.prepared_by_name} · {fmtTime(checklist.created_at)}
            </div>
            {checklist.taken_over_from_name && checklist.taken_over_at ? (
              <div className="mono cell-sub" style={{ maxWidth: "none" }}>
                Started by {checklist.taken_over_from_name}
                {checklist.started_at ? ` at ${fmtTime(checklist.started_at)}` : ""} · taken over at {fmtTime(checklist.taken_over_at)}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={checklist.overall_ready ? "teal" : "red"}>{checklist.overall_ready ? "Ready" : "Not Ready"}</Badge>
            {!checklist.void ? <VoidChecklistButton id={checklist.id} canEdit={canVoid} /> : null}
          </div>
        </div>
      </div>

      {flagged.length > 0 ? (
        <div className="card">
          <div className="card-head"><span>Flagged items</span></div>
          <ul className="feed">
            {flagged.map((i) => (
              <li key={i.id} className="feed-row feed-row-block">
                <span className="feed-dot tone-red" />
                <div className="feed-main">
                  <div className="feed-label">{i.name}</div>
                  <div className="feed-meta">{i.category}</div>
                </div>
                <Badge tone="red">{i.condition}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head"><span>All items</span></div>
        <ul className="feed">
          {items.map((i) => (
            <li key={i.id} className="feed-row feed-row-block">
              <span className={`feed-dot ${i.condition === "Good" ? "tone-teal" : i.condition === "Damaged" || i.condition === "Missing" ? "tone-red" : ""}`} />
              <div className="feed-main">
                <div className="feed-label">{i.name}{i.qty ? ` · qty ${i.qty}` : ""}</div>
                <div className="feed-meta">{i.category}</div>
              </div>
              <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>{i.condition ?? i.available}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
