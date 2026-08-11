import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT } from "@/lib/types";
import { getOffDutyLogs } from "@/lib/data/attendance";
import { OffDutyClient } from "./offduty-client";

export default async function OffDutyPage() {
  const session = await requirePageAccess("/offduty");
  const logs = await getOffDutyLogs();
  return <OffDutyClient logs={logs} canEdit={GH_CAN_EDIT.includes(session.role)} />;
}
