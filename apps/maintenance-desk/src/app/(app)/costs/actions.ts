"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { isUnit, MD_MANAGE_ROLES } from "@/lib/types";
import { addPurchase, voidExpense } from "@/lib/data/expenses";
import { getTicket } from "@/lib/data/tickets";

const refresh = () => {
  for (const p of ["/costs", "/spending", "/funding", "/dashboard", "/board", "/requests"]) revalidatePath(p);
};

const MAX_LINE = 50_000_000; // a guard against typing mistakes, not a policy limit

// One receipt: any number of items, for a job (ticket or request) or the unit's stock.
export async function addPurchaseAction(input: {
  unit: string;
  jobId: string; // a ticket id, or "STOCK"
  supplier: string;
  date: string; // YYYY-MM-DD
  lines: { item: string; quantity: number; unitCost: number }[];
}) {
  const session = await requireRole(MD_MANAGE_ROLES);
  if (!isUnit(input.unit)) throw new Error("Choose your unit.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Give the date it was bought.");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  if (input.date > today) throw new Error("The date bought can’t be in the future.");
  let ticketId: string | null = null;
  if (input.jobId !== "STOCK") {
    const job = await getTicket(input.jobId);
    if (!job || job.void) throw new Error("Choose the job this was bought for, or stock for the unit.");
    ticketId = job.id;
  }
  const lines = input.lines.filter((l) => l.item.trim() || l.unitCost);
  if (!lines.length) throw new Error("Add at least one item.");
  lines.forEach((l, i) => {
    if (!l.item.trim() || !(l.quantity > 0) || !(l.unitCost >= 0)) throw new Error(`Line ${i + 1}: give the item, a quantity above 0 and the unit cost in Naira.`);
    if (l.quantity * l.unitCost > MAX_LINE) throw new Error(`Line ${i + 1} comes to more than ₦50,000,000. Check the amounts.`);
  });
  await addPurchase(
    { unit: input.unit, ticketId, supplier: input.supplier.trim() || null, purchasedOn: input.date, lines: lines.map((l) => ({ item: l.item.trim(), quantity: l.quantity, unitCost: l.unitCost })) },
    { staffId: session.staffId, name: session.displayName }
  );
  refresh();
}

export async function voidExpenseAction(id: string, reason: string) {
  const session = await requireRole(MD_MANAGE_ROLES);
  if (!reason.trim()) throw new Error("A reason is required to void a purchase line.");
  await voidExpense(id, reason.trim(), session.displayName);
  refresh();
}
