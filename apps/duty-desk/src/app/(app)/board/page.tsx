import { requirePageAccess } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { DD_CAN_EDIT_CHECKLISTS, DD_CAN_EDIT_RESIDENTS, DD_CAN_EDIT_TICKETS } from "@/lib/types";
import { DD_ALL_ITEMS } from "@/lib/checklist-data";
import { getReadiness, READY_DAYS } from "@/lib/data/readiness";
import { toBoardApt } from "@/lib/board";
import { getTasks } from "@/lib/data/tasks";
import { taskState } from "@/lib/tasks";
import { BoardClient } from "./board-client";

export default async function BoardPage({ searchParams }: { searchParams: { apt?: string } }) {
  const session = await requirePageAccess("/board");
  const [readiness, tasks] = await Promise.all([getReadiness(), getTasks()]);
  const apts = readiness.map((r) => toBoardApt(r, session.staffId));
  // Open tasks about each apartment (e.g. "check the status of Lisbon").
  const openTasks: Record<string, { id: string; description: string; who: string; due: string | null; overdue: boolean }[]> = {};
  for (const t of tasks) {
    if (t.void || t.status !== "Pending") continue;
    for (const a of t.apartments) (openTasks[a] ??= []).push({ id: t.id, description: t.description, who: t.assigned_to || "Anyone on duty", due: t.due_time, overdue: taskState(t) === "overdue" });
  }
  return (
    <BoardClient
      key={searchParams.apt ?? ""}
      apts={apts}
      openTasks={openTasks}
      canPrep={DD_CAN_EDIT_CHECKLISTS.includes(session.role)}
      canStay={DD_CAN_EDIT_RESIDENTS.includes(session.role)}
      canReport={DD_CAN_EDIT_TICKETS.includes(session.role)}
      ticketLinks={navForRole(session.role).some((i) => i.href === "/maintenance")}
      initialApt={searchParams.apt ?? ""}
      readyDays={READY_DAYS}
      totalChecks={DD_ALL_ITEMS.length}
    />
  );
}
