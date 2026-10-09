import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_DUTY_LOG, DD_CAN_VOID } from "@/lib/types";
import { getDutyLog } from "@/lib/data/dutylog";
import { draftHandover } from "@/lib/data/handover";
import { clockTime, dayText, lagosDayKey, lagosHour, shiftName, whenText } from "@/lib/time";
import { DutyLogClient, type LogView } from "./dutylog-client";

export default async function DutyLogPage() {
  const session = await requirePageAccess("/dutylog");
  const canEdit = DD_CAN_EDIT_DUTY_LOG.includes(session.role);
  const [entries, draft] = await Promise.all([getDutyLog(), canEdit ? draftHandover() : Promise.resolve("")]);

  const now = new Date();
  const today = lagosDayKey(now.toISOString()), yesterday = lagosDayKey(new Date(now.getTime() - 86400000).toISOString());
  const views: LogView[] = entries.map((e) => {
    const k = lagosDayKey(e.created_at);
    return {
      ...e,
      day: k,
      dayLabel: k === today ? "Today" : k === yesterday ? "Yesterday" : dayText(e.created_at),
      time: clockTime(e.created_at),
      shift: shiftName(lagosHour(e.created_at)),
      ackWhen: e.acknowledged_at ? whenText(e.acknowledged_at) : null,
      mine: e.officer_id === session.staffId,
    };
  });

  return <DutyLogClient entries={views} draft={draft} shiftNow={shiftName()} canEdit={canEdit} canVoid={DD_CAN_VOID.includes(session.role)} />;
}
