import Link from "next/link";
import type { BoardReason } from "@/lib/board";

const REPAIR_TONE: Record<BoardReason["repair"], string> = { open: "t-warn", progress: "t-info", fixed: "t-ok", none: "t-neu" };

// Why an apartment can't be sold: every reason, who gave it and when, its team, and where the
// repair stands. `brief` (front desk) leaves out the notes and who/when; `links` goes to the
// ticket and the check-in prep, for people who can open them. `occupied`: a guest is still in,
// so problems were reported rather than putting it under maintenance yet.
export function ReasonList({ reasons, links, brief = false, occupied = false }: { reasons: BoardReason[]; links: boolean; brief?: boolean; occupied?: boolean }) {
  return (
    <ul className="reasons">
      {reasons.map((r, i) => (
        <li key={`${r.ticketId ?? r.item}-${i}`}>
          <div className="top">
            {r.from === "prep" ? <span className="badge t-bad"><span className="d" />{r.problem}</span> : null}
            <b>{r.item}</b>
            <span className={`badge ${REPAIR_TONE[r.repair]}`} style={{ marginLeft: "auto" }}>{r.repairText}</span>
          </div>
          {!brief && r.note ? <p className="note">{r.note}</p> : null}
          {!brief ? (
            <span className="by">
              {r.from === "prep" ? "Flagged in a check-in prep" : occupied ? "Reported" : "Put under maintenance"} by <b>{r.by}</b> · {r.when}
              {r.ticketId && links ? <> · <Link href={`/maintenance?id=${r.ticketId}`}>{r.ref ?? "Ticket"}</Link></> : r.ref ? ` · ${r.ref}` : null}
              {r.prepId && links ? <> · <Link href={`/checklists/${r.prepId}`}>Check-in prep</Link></> : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
