import { requireSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { NewCodeForm } from "./new-code-form";

export default async function NewCodePage() {
  const session = await requireSession({ allowCodeChange: true });
  const { data } = await supabaseAdmin.from("staff_accounts").select("must_change_code").eq("id", session.staffId).maybeSingle();
  if (!data?.must_change_code) redirect("/dashboard");
  return <NewCodeForm name={session.displayName.split(" ")[0]} username={session.username} />;
}
