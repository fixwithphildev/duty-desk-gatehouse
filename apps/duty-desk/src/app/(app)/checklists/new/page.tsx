import { requireRole } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { ChecklistForm } from "./checklist-form";

export default async function NewChecklistPage() {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  return <ChecklistForm preparedByName={session.displayName} />;
}
