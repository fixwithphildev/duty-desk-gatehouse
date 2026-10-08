import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_TASKS, DD_CAN_VOID } from "@/lib/types";
import { getTasks } from "@/lib/data/tasks";
import { getActiveStaffNames } from "@/lib/data/staff";
import { DD_COMPLAINT_TEAMS } from "@/lib/checklist-data";
import { taskState } from "@/lib/tasks";
import { clockTime, dayText } from "@/lib/time";
import { TasksClient, type TaskView } from "./tasks-client";

export default async function TasksPage() {
  const session = await requirePageAccess("/tasks");
  const [all, staff] = await Promise.all([getTasks(), getActiveStaffNames()]);

  // Housekeeping only sees tasks given to Housekeeping or to them by name.
  const mine = (t: { assigned_to: string | null }) => {
    const a = (t.assigned_to ?? "").toLowerCase();
    return a.includes("housekeeping") || a === session.displayName.toLowerCase();
  };
  const tasks = session.role === "housekeeping" ? all.filter(mine) : all;

  const views: TaskView[] = tasks
    .filter((t) => !t.void)
    .map((t) => ({
      ...t,
      state: taskState(t),
      addedDay: dayText(t.created_at),
      doneTime: t.done_at ? clockTime(t.done_at) : null,
      doneDay: t.done_at ? dayText(t.done_at) : null,
    }));

  return (
    <TasksClient
      tasks={views}
      assignees={[...DD_COMPLAINT_TEAMS, ...staff]}
      canEdit={DD_CAN_EDIT_TASKS.includes(session.role)}
      canTick={DD_CAN_EDIT_TASKS.includes(session.role) || session.role === "housekeeping"}
      canVoid={DD_CAN_VOID.includes(session.role)}
      me={session.displayName}
    />
  );
}
