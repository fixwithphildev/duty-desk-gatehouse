import "server-only";
import { aptShort, aptWhere } from "@/lib/apartments";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import { STATUS_LABEL, READY_DAYS, type Readiness, type ReadyStatus } from "@/lib/data/readiness";
import { clockTime, dayText, daysAgo, shortName, whenText } from "@/lib/time";
import type { DraftInfo } from "@/components/start-prep-button";

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
  flags: { item: string; problem: string; ticketStatus: string | null }[];
  draft: DraftInfo | null;
  lastPrepId: string | null;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

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
    case "notready":
      meta = r.flags.length ? `${plural(r.flags.length, "flag")} · ${whenText(p!.at)}` : whenText(p!.at);
      detail = `Problem found ${whenText(p!.at)} by ${p!.by}. Sellable again once repaired and a new check-in prep is submitted Ready.`;
      break;
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
    flags: r.flags.map((f) => ({ item: f.item, problem: f.problem, ticketStatus: f.ticketStatus })),
    draft: d ? { id: d.id, by: d.prepared_by_name, mine: d.prepared_by === staffId } : null,
    lastPrepId: p?.id ?? null,
  };
}

