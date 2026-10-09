"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Lock } from "lucide-react";
import { startChecklistAction } from "@/app/(app)/checklists/new/actions";
import { isRedirectError, errorMessage } from "@/lib/utils";
import { callAction } from "@/lib/action";
import { shortName } from "@/lib/time";

export interface DraftInfo {
  id: string;
  by: string;
  mine: boolean;
}

// Starts (or continues) the check-in prep for one apartment. If someone else is already
// inspecting it, it says who and opens their checklist, where it can be taken over.
export function StartPrepButton({
  apartment,
  draft,
  label = "Start check-in prep",
  primary = false,
  small = true,
}: {
  apartment: string;
  draft: DraftInfo | null;
  label?: string;
  primary?: boolean;
  small?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls = `btn ${primary ? "btn-primary" : "btn-secondary"} ${small ? "btn-sm" : ""}`;

  if (draft) {
    return (
      <Link href={`/checklists/${draft.id}`} className={draft.mine ? cls : `btn btn-ghost ${small ? "btn-sm" : ""}`}>
        {draft.mine ? <ClipboardCheck size={14} /> : <Lock size={14} />}
        {draft.mine ? "Continue check-in prep" : `Being inspected by ${shortName(draft.by)}`}
      </Link>
    );
  }

  const start = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await callAction(startChecklistAction)({ apartment, type: "check_in_prep" });
        router.push(`/checklists/${r.ok ? r.id : r.taken.id}`);
      } catch (e) {
        if (isRedirectError(e)) throw e;
        setError(errorMessage(e));
      }
    });
  };

  return (
    <>
      <button type="button" className={cls} onClick={start} disabled={pending}>
        <ClipboardCheck size={14} /> {pending ? "Starting…" : label}
      </button>
      {error ? <span className="hint" style={{ color: "var(--bad-fg)" }}>{error}</span> : null}
    </>
  );
}
