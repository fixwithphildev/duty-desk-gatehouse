import { requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { whenText } from "@/lib/time";
import { AccountClient } from "./account-client";

export default async function AccountPage() {
  const session = await requireSession();
  // The last few sign-in attempts on this username, so people can spot one that wasn't them.
  const { data } = await supabaseAdmin
    .from("login_events")
    .select("id, success, reason, created_at")
    .ilike("username_attempted", session.username.replace(/[%_\\]/g, "\\$&"))
    .order("created_at", { ascending: false })
    .limit(6);
  const recent = (data ?? []).map((e) => ({ id: e.id as string, success: !!e.success, reason: (e.reason as string | null) ?? null, when: whenText(e.created_at as string) }));
  return <AccountClient username={session.username} displayName={session.displayName} role={session.role} recent={recent} />;
}
