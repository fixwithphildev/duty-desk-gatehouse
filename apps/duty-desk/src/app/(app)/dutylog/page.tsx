import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_DUTY_LOG, DD_CAN_VOID } from "@/lib/types";
import { getDutyLog } from "@/lib/data/dutylog";
import { DutyLogClient } from "./dutylog-client";

export default async function DutyLogPage() {
  const session = await requirePageAccess("/dutylog");
  const entries = await getDutyLog();
  return (
    <DutyLogClient
      entries={entries}
      canEdit={DD_CAN_EDIT_DUTY_LOG.includes(session.role)}
      canVoid={DD_CAN_VOID.includes(session.role)}
    />
  );
}
