import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getNotificationsSince } from "@/lib/data/notifications";
import { getMyUnit } from "@/lib/data/desk";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const since = req.nextUrl.searchParams.get("since") ?? new Date(Date.now() - 60_000).toISOString();
  const unit = session.role === "maintenance_technician" ? await getMyUnit(session.staffId) : null;
  const items = await getNotificationsSince(since, unit);
  return NextResponse.json({ items, checkedAt: new Date().toISOString() });
}
