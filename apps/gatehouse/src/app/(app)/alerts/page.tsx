import { requireSession } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { AlertsClient } from "./alerts-client";

export default async function AlertsPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await requireSession();
  const { alerts } = await getDesk();
  return <AlertsClient key={searchParams.id ?? ""} alerts={alerts} now={Date.now()} initialId={searchParams.id ?? null} canEdit={GH_CAN_EDIT.includes(session.role)} canVoid={GH_CAN_VOID.includes(session.role)} />;
}
