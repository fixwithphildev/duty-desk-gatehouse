import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS, DD_CAN_EDIT_RESIDENTS, DD_CAN_EDIT_TICKETS } from "@/lib/types";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import { getReadiness, READY_DAYS } from "@/lib/data/readiness";
import { toBoardApt } from "@/lib/board";
import { BoardClient } from "./board-client";

export default async function BoardPage({ searchParams }: { searchParams: { apt?: string } }) {
  const session = await requirePageAccess("/board");
  const readiness = await getReadiness();
  const apts = readiness.map((r) => toBoardApt(r, session.staffId));
  return (
    <BoardClient
      key={searchParams.apt ?? ""}
      apts={apts}
      canPrep={DD_CAN_EDIT_CHECKLISTS.includes(session.role)}
      canStay={DD_CAN_EDIT_RESIDENTS.includes(session.role)}
      canReport={DD_CAN_EDIT_TICKETS.includes(session.role)}
      initialApt={searchParams.apt ?? ""}
      readyDays={READY_DAYS}
      totalChecks={DD_ALL_ITEMS.length}
    />
  );
}
