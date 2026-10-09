import { requireSession } from "@/lib/auth";
import { getDesk } from "@/lib/data/desk";
import { GH_CAN_EDIT, GH_CAN_VOID } from "@/lib/types";
import { ItemsClient } from "./items-client";

export default async function ItemsPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await requireSession();
  const { items } = await getDesk();
  return <ItemsClient items={items} now={Date.now()} focusId={searchParams.id ?? null} canEdit={GH_CAN_EDIT.includes(session.role)} canVoid={GH_CAN_VOID.includes(session.role)} />;
}
