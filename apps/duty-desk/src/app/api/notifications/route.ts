import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getNotificationsSince } from "@/lib/data/notifications";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const since = req.nextUrl.searchParams.get("since") ?? new Date(Date.now() - 60_000).toISOString();
  const items = await getNotificationsSince(since, session.role);
  return NextResponse.json({ items, checkedAt: new Date().toISOString() });
}
