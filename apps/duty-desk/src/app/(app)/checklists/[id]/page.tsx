import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePageAccess } from "@/lib/auth";
import { getChecklistWithItems } from "@/lib/data/checklists";
import { Badge } from "@/components/ui";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function checklistTypeLabel(type: string): string {
  return type === "check_in_prep" ? "Check-in Prep" : "Check-out Inspection";
}

export default async function ViewChecklistPage({ params }: { params: { id: string } }) {
  await requirePageAccess("/checklists");
  const result = await getChecklistWithItems(params.id);
  if (!result) notFound();
  const { checklist, items } = result;
  const flagged = items.filter((i) => i.condition === "Damaged" || i.condition === "Missing");

  return (
    <div className="view">
      <div className="view-head">
        <Link href="/checklists" className="btn btn-ghost"><ChevronLeft size={14} /> Back</Link>
      </div>
      <div className="card">
        <div className="view-checklist-head">
          <div>
            <h2>Apartment {checklist.apartment}</h2>
            <div className="mono cell-sub">
              {checklistTypeLabel(checklist.type)} · prepared by {checklist.prepared_by_name} · {fmtTime(checklist.created_at)}
            </div>
          </div>
          <Badge tone={checklist.overall_ready ? "teal" : "red"}>{checklist.overall_ready ? "Ready" : "Not Ready"}</Badge>
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
