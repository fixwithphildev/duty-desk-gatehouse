import { requireSession } from "@/lib/auth";
import { AccountClient } from "./account-client";

export default async function AccountPage() {
  const session = await requireSession();
  return <AccountClient username={session.username} displayName={session.displayName} role={session.role} />;
}
