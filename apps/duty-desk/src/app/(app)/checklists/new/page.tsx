import { requireRole } from "@/lib/auth";
import { DD_CAN_EDIT_CHECKLISTS } from "@/lib/types";
import { ChecklistForm } from "./checklist-form";

// Raised from the 10s Vercel default: submitting inserts the checklist row,
// up to ~84 checklist items, and any flagged-item tickets. That's normally
// under a second, but free-tier Supabase/Vercel cold starts can add several
// seconds of latency on an infrequently-hit route like this one.
export const maxDuration = 30;

export default async function NewChecklistPage() {
  const session = await requireRole(DD_CAN_EDIT_CHECKLISTS);
  return <ChecklistForm preparedByName={session.displayName} />;
}
