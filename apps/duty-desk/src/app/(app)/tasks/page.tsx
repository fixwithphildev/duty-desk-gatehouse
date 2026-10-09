import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_TASKS, DD_CAN_VOID } from "@/lib/types";
import { getTasks } from "@/lib/data/tasks";
import { getTaskPeople } from "@/lib/data/staff";
import { DD_TICKET_DEPTS } from "@/lib/checklist-data";
import { taskState } from "@/lib/tasks";
import { clockTime, dayText } from "@/lib/time";
import { TasksClient, type TaskView } from "./tasks-client";

export default async function TasksPage() {
  const session = await requirePageAccess("/tasks");
  const [all, people] = await Promise.all([getTasks(), getTaskPeople()]);

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
      officers={people.officers}
      teams={["Resident Officers", ...DD_TICKET_DEPTS]}
      others={people.others}
      canEdit={DD_CAN_EDIT_TASKS.includes(session.role)}
      canTick={DD_CAN_EDIT_TASKS.includes(session.role) || session.role === "housekeeping"}
      canVoid={DD_CAN_VOID.includes(session.role)}
      me={session.displayName}
    />
  );
}
