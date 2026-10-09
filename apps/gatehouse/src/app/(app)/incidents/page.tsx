import { requireSession } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { IncidentsClient } from "./incidents-client";

export default async function IncidentsPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await requireSession();
  const { incidents } = await getDesk();
  return <IncidentsClient key={searchParams.id ?? ""} incidents={incidents} now={Date.now()} initialId={searchParams.id ?? null} canEdit={GH_CAN_EDIT.includes(session.role)} canVoid={GH_CAN_VOID.includes(session.role)} />;
}
