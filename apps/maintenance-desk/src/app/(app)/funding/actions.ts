"use server";

import { guarded } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { MD_MANAGE_ROLES } from "@/lib/types";
import { addFundingTx, getFunding, requestBalance, setAmountNeeded, voidFundingTx } from "@/lib/data/funding";
import { getTicket } from "@/lib/data/tickets";
import type { TxKind } from "@/lib/funding";

const refresh = () => {
  for (const p of ["/funding", "/dashboard", "/board", "/requests", "/costs"]) revalidatePath(p);
};
const MAX = 500_000_000; // a guard against typing mistakes

// One form records any money from Finance (or returned to Finance) against a job,
// and the total the job needs.
async function recordFundingAction__run(input: {
  jobId: string;
  need: number | null; // total the job needs; null to keep what's there
  direction: "in" | "out";
  amount: number;
  date: string; // YYYY-MM-DD
  reference: string;
  financeOfficer: string;
  paysBack: string;
}) {
  const session = await requireRole(MD_MANAGE_ROLES);
  const job = await getTicket(input.jobId);
  if (!job || job.void) throw new Error("Choose the job.");
  const existing = (await getFunding()).get(job.id);
  if (input.need != null && !(input.need > 0 && input.need <= MAX)) throw new Error("Enter what the job needs in total, like 100,000.");
  if (input.need == null && !existing?.need) throw new Error("Enter what the job needs in total, like 100,000.");
  if (!(input.amount > 0 && input.amount <= MAX)) throw new Error("Enter the amount, like 50,000.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Give the date.");
  if (input.date > new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })) throw new Error("The date can’t be in the future.");

  if (input.need != null) await setAmountNeeded(job.id, input.need, session.displayName);
  const kind: TxKind = input.direction === "out" ? "return" : job.status === "Resolved" ? "balance" : "advance";
  await addFundingTx(
    job.id,
    { kind, amount: input.amount, date: input.date, reference: input.reference.trim() || null, financeOfficer: input.financeOfficer.trim() || null, paysBack: kind === "balance" ? input.paysBack.trim() || null : null },
    { staffId: session.staffId, name: session.displayName }
  );
  refresh();
}

async function requestBalanceAction__run(jobId: string, amount: number) {
  const session = await requireRole(MD_MANAGE_ROLES);
  if (!(amount > 0)) throw new Error("Nothing is owed on this job.");
  await requestBalance(jobId, amount, session.displayName);
  refresh();
}

async function voidFundingAction__run(id: string, reason: string) {
  const session = await requireRole(MD_MANAGE_ROLES);
  if (!reason.trim()) throw new Error("A reason is required.");
  await voidFundingTx(id, reason.trim(), session.displayName);
  refresh();
}

export async function recordFundingAction(...args: Parameters<typeof recordFundingAction__run>) {
  return guarded(() => recordFundingAction__run(...args));
}

export async function requestBalanceAction(...args: Parameters<typeof requestBalanceAction__run>) {
  return guarded(() => requestBalanceAction__run(...args));
}

export async function voidFundingAction(...args: Parameters<typeof voidFundingAction__run>) {
  return guarded(() => voidFundingAction__run(...args));
}
