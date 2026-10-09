import { requireSession } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { PatrolsClient } from "./patrols-client";

export default async function PatrolsPage() {
  const session = await requireSession();
  const { patrols } = await getDesk();
  return (
    <PatrolsClient
      patrols={patrols}
      now={Date.now()}
      meId={session.staffId}
      canEdit={GH_CAN_EDIT.includes(session.role)}
      canFinishAny={session.role === "security_supervisor" || session.role === "super_admin"}
      canVoid={GH_CAN_VOID.includes(session.role)}
    />
  );
}
