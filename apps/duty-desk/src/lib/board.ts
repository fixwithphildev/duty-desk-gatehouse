import "server-only";
import { aptShort, aptWhere } from "@/lib/apartments";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import { STATUS_LABEL, READY_DAYS, openReasons, type Readiness, type Reason, type ReadyStatus } from "@/lib/data/readiness";
import { clockTime, dayText, daysAgo, lagosDayKey, shortName, whenText } from "@/lib/time";
import type { DraftInfo } from "@/components/start-prep-button";

// One reason it can't be sold, as the board and the front desk page show it.
export interface BoardReason {
  item: string;
  problem: string; // "Reported", "Damaged", "Missing", "Not available"
  note: string | null;
  from: "report" | "prep";
  by: string;
  when: string;
  prepId: string | null;
  ticketId: string | null;
  ref: string | null;
  team: string | null;
  repair: "open" | "progress" | "fixed" | "none";
  repairText: string; // "Waiting for Plumbing & Building", "Being fixed · Musa", "Fixed by Musa · today 14:20"
}

// One apartment as the Readiness Board, the front desk page and search show it.
export interface BoardApt {
  name: string;
  building: string;
  floor: string;
  type: string;
  where: string;
  short: string;
  status: ReadyStatus;
  label: string;
  meta: string; // the small line on the tile
  detail: string; // the sentence in the lookup result
  reasons: BoardReason[];
  draft: DraftInfo | null;
  lastPrepId: string | null;
  // The guest staying, when it's Occupied.
  stay: { id: string; guest: string; until: string | null; leavesToday: boolean } | null;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function toBoardReason(r: Reason): BoardReason {
  const t = r.ticket;
  const repair = !t ? "none" : t.status === "Resolved" ? "fixed" : t.status === "In Progress" ? "progress" : "open";
  const repairText =
    !t ? "No repair ticket"
      : t.status === "Resolved" ? `Fixed${t.fixedBy ? ` by ${t.fixedBy}` : ""}${t.fixedAt ? ` · ${whenText(t.fixedAt)}` : ""}`
      : t.status === "In Progress" ? `Being fixed${t.startedBy ? ` · ${t.startedBy}` : ""}`
      : `Waiting for ${t.team}`;
  return { item: r.item, problem: r.problem, note: r.note, from: r.from, by: r.by, when: whenText(r.at), prepId: r.prepId, ticketId: t?.id ?? null, ref: t?.ref ?? null, team: t?.team ?? null, repair, repairText };
}

export function toBoardApt(r: Readiness, staffId: string): BoardApt {
  const total = DD_ALL_ITEMS.length, p = r.lastPrep, d = r.draft;
  let meta = "", detail = "";
  switch (r.status) {
    case "ready":
      meta = `${plural(r.daysLeft ?? 0, "day")} left`;
      detail = `Check-in prep submitted Ready ${whenText(p!.at)} by ${p!.by}. Front desk can sell it until ${dayText(r.readyUntil!)}. You don’t need to do anything until it’s sold.`;
      break;
    case "recheck":
      meta = `Ready ${plural(daysAgo(p!.at), "day")} ago`;
      detail = `Submitted Ready ${plural(daysAgo(p!.at), "day")} ago and still unsold. A Ready check-in prep lasts ${READY_DAYS} days; check it again before front desk sells it.`;
      break;
    case "maintenance": {
      const open = openReasons(r).length, first = r.reasons[r.reasons.length - 1];
      meta = `${plural(open, "repair")} open`;
      detail = `${first.from === "report" ? `Put under maintenance ${whenText(first.at)} by ${first.by}` : `Check-in prep found problems ${whenText(first.at)} (${first.by})`}. Front desk can’t sell it until every repair is fixed and a check-in prep is submitted Ready.`;
      break;
    }
    case "repaired": {
      const last = r.reasons.map((x) => x.ticket).filter((t) => t?.fixedAt).sort((x, y) => y!.fixedAt!.localeCompare(x!.fixedAt!))[0];
      meta = "Needs re-check";
      detail = `All repairs are done${last ? `, the last ${whenText(last.fixedAt!)}${last.fixedBy ? ` by ${last.fixedBy}` : ""}` : ""}. A Resident Officer needs to do a check-in prep before front desk can sell it.`;
      break;
    }
    case "notready":
      meta = whenText(p!.at);
      detail = `Check-in prep submitted Not ready ${whenText(p!.at)} by ${p!.by}, with no repair to wait for. Do a new check-in prep once it’s sorted.`;
      break;
    case "occupied": {
      const s = r.stay!, gone = s.until ? s.until <= lagosDayKey(new Date().toISOString()) : false;
      meta = s.until ? (gone ? "Leaves today" : `Out ${dayText(s.until)}`) : shortName(s.guest);
      detail = `${s.guest} checked in ${whenText(s.since)}${s.until ? `, leaving ${gone ? "today" : dayText(s.until)}` : ""}. It can’t be sold until the check-out is recorded and a new check-in prep is submitted Ready.`;
      break;
    }
    case "inspecting":
      meta = `${d!.answered}/${total} · ${shortName(d!.prepared_by_name)}`;
      detail = `${d!.prepared_by_name} started at ${clockTime(d!.started_at)} · ${d!.answered} of ${total} checks done · saved ${clockTime(d!.updated_at)}. Front desk can sell it once the check-in prep is submitted Ready.`;
      break;
    default:
      meta = r.lastCheckout ? `Out ${dayText(r.lastCheckout.at)}` : "Never inspected";
      detail = `${r.lastCheckout ? `Guest checked out ${whenText(r.lastCheckout.at)}` : "No check-in prep yet in Duty Desk"}. A Resident Officer needs to do a check-in prep before front desk can sell it.`;
  }
  return {
    name: r.apartment.name,
    building: r.apartment.building,
    floor: r.apartment.floor,
    type: r.apartment.type,
    where: aptWhere(r.apartment),
    short: aptShort(r.apartment),
    status: r.status,
    label: STATUS_LABEL[r.status],
    meta,
    detail,
    reasons: r.reasons.map(toBoardReason),
    draft: d ? { id: d.id, by: d.prepared_by_name, mine: d.prepared_by === staffId } : null,
    lastPrepId: p?.id ?? null,
    stay: r.stay ? { id: r.stay.id, guest: r.stay.guest, until: r.stay.until, leavesToday: !!r.stay.until && r.stay.until <= lagosDayKey(new Date().toISOString()) } : null,
  };
}
