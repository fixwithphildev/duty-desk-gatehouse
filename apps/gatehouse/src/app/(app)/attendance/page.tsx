import { requirePageAccess } from "@/lib/auth";
import { GH_CAN_EDIT } from "@/lib/types";
import { getAttendanceLogs } from "@/lib/data/attendance";
import { AttendanceClient } from "./attendance-client";

export default async function AttendancePage() {
  const session = await requirePageAccess("/attendance");
  const logs = await getAttendanceLogs();
  return <AttendanceClient logs={logs} canEdit={GH_CAN_EDIT.includes(session.role)} />;
}
