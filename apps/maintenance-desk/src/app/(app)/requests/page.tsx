import { requirePageAccess } from "@/lib/auth";
import { MD_MANAGE_ROLES, MD_MONEY_ROLES, MD_REQUEST_ROLES, MD_WORK_ROLES } from "@/lib/types";
import { getDesk, getMyUnit, getTeam } from "@/lib/data/desk";
import { RequestsClient } from "./requests-client";

export default async function RequestsPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await requirePageAccess("/requests");
  const isTech = session.role === "maintenance_technician";
  const [{ jobs }, team, unit] = await Promise.all([getDesk(), getTeam(), isTech ? getMyUnit(session.staffId) : Promise.resolve(null)]);
  return (
    <RequestsClient
      key={searchParams.id ?? ""}
      jobs={jobs.filter((j) => j.isRequest && !j.void)}
      team={team}
      me={{ name: session.displayName, isTechnician: isTech, unit }}
      canManage={MD_MANAGE_ROLES.includes(session.role)}
      canRequest={MD_REQUEST_ROLES.includes(session.role)}
      canMoney={MD_MONEY_ROLES.includes(session.role)}
      canWorkAny={MD_WORK_ROLES.includes(session.role)}
      viewOnly={session.role === "head_of_operations" || session.role === "maintenance_manager"}
      initialId={searchParams.id ?? null}
      initialUnit={unit ?? "all"}
    />
  );
}
