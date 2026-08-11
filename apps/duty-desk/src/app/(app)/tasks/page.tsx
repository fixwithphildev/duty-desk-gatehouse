import { requirePageAccess } from "@/lib/auth";
import { DD_CAN_EDIT_TASKS } from "@/lib/types";
import { getTasks } from "@/lib/data/tasks";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  const session = await requirePageAccess("/tasks");
  const assignedFilter = session.role === "housekeeping" ? "housekeeping" : undefined;
  const tasks = await getTasks(assignedFilter);
  return <TasksClient tasks={tasks} canEdit={DD_CAN_EDIT_TASKS.includes(session.role)} />;
}
