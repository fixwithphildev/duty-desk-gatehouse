import { requirePageAccess } from "@/lib/auth";
import { MD_MANAGE_ROLES, MD_MONEY_ROLES, MD_WORK_ROLES } from "@/lib/types";
import { getDesk, getMyUnit, getTeam } from "@/lib/data/desk";
import { BoardClient } from "./board-client";

export default async function BoardPage({ searchParams }: { searchParams: { id?: string; unit?: string; view?: string } }) {
  const session = await requirePageAccess("/board");
  const isTech = session.role === "maintenance_technician";
  const [{ jobs }, team, unit] = await Promise.all([getDesk(), getTeam(), isTech ? getMyUnit(session.staffId) : Promise.resolve(null)]);
  return (
    <BoardClient
      key={searchParams.id ?? ""}
      jobs={jobs.filter((j) => !j.isRequest && !j.void)}
      team={team.byUnit}
      me={{ name: session.displayName, isTechnician: isTech, unit }}
      canManage={MD_MANAGE_ROLES.includes(session.role)}
      canMoney={MD_MONEY_ROLES.includes(session.role)}
      canWorkAny={MD_WORK_ROLES.includes(session.role)}
      initialId={searchParams.id ?? null}
      initialView={searchParams.view === "list" ? "list" : "board"}
      initialUnit={searchParams.unit ?? unit ?? "all"}
    />
  );
}
