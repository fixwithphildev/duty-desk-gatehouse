import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getNotificationsSince } from "@/lib/data/notifications";

// The bell's next check starts this far back. A change saved while this check
// runs, or stamped by a server whose clock is a little behind (Maintenance
// Desk sets its own times), is then still caught next time. The bell skips
// events it has already shown, so the overlap never repeats an alert.
const OVERLAP_MS = 60_000;

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const checkedAt = new Date(Date.now() - OVERLAP_MS).toISOString();
  const since = req.nextUrl.searchParams.get("since") ?? checkedAt;
  const items = await getNotificationsSince(since, { role: session.role, staffId: session.staffId, displayName: session.displayName });
  return NextResponse.json({ items, checkedAt });
}
