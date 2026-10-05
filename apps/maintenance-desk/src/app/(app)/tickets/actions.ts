"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireSession } from "@/lib/auth";
import { MD_CAN_EDIT_TICKETS, MD_CAN_VOID, MD_DEPARTMENTS, type TicketStatus } from "@/lib/types";
import { createTicket, updateTicketStatus, voidTicket, uploadTicketPhoto, getTicketPhotoUrls, getTicketStatus } from "@/lib/data/tickets";
import { addExpenses, getTicketExpenses, markNoPurchase, voidExpense, type ExpenseLine, type NewExpenseLine } from "@/lib/data/expenses";
import { todayLocal } from "@/lib/reports/spending";

function revalidateAll() {
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  revalidatePath("/spending");
}

export async function createTicketAction(formData: FormData) {
  const session = await requireRole(MD_CAN_EDIT_TICKETS);
  const area = String(formData.get("area") ?? "").trim();
  const issueType = String(formData.get("issueType") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "");
  const priority = String(formData.get("priority") ?? "Medium") as "Low" | "Medium" | "High";
  const photo = formData.get("photo") as File | null;

  if (!area || !issueType) throw new Error("Area and issue are required.");
  if (!(MD_DEPARTMENTS as readonly string[]).includes(assignedTo)) throw new Error("Invalid department.");

  const { id } = await createTicket({ area, issueType, assignedTo, priority, loggedByName: session.displayName });

  if (photo && photo.size > 0) {
    await uploadTicketPhoto(id, photo);
  }

  revalidateAll();
}

// Reported <-> In Progress only. Moving a ticket to Resolved goes through
// resolveTicketAction, which also records what was bought to fix it.
export async function updateTicketStatusAction(id: string, status: TicketStatus) {
  const session = await requireRole(MD_CAN_EDIT_TICKETS);
  if (status === "Resolved") throw new Error("Record what was bought (or tick 'No purchase needed') to resolve a ticket.");
  await updateTicketStatus(id, status, session.displayName);
  revalidateAll();
}

export interface ExpenseLineInput {
  item: string;
  quantity: number | string;
  unitCost: number | string;
  supplier?: string;
  purchasedOn: string;
}

const MAX_AMOUNT = 1_000_000_000; // ₦1bn per line — anything above is a typo

function validateLines(input: ExpenseLineInput[]): NewExpenseLine[] {
  const today = todayLocal();
  return input.map((raw, i) => {
    const n = i + 1;
    const item = String(raw.item ?? "").trim();
    const quantity = Number(raw.quantity);
    const unitCost = Number(raw.unitCost);
    const purchasedOn = String(raw.purchasedOn ?? "");
    const supplier = String(raw.supplier ?? "").trim();
    if (!item) throw new Error(`Line ${n}: enter what was bought.`);
    if (item.length > 200) throw new Error(`Line ${n}: item description is too long.`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Line ${n}: quantity must be more than 0.`);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error(`Line ${n}: enter a valid unit cost.`);
    if (quantity * unitCost > MAX_AMOUNT) throw new Error(`Line ${n}: amount looks too large — please check it.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedOn)) throw new Error(`Line ${n}: enter the purchase date.`);
    if (purchasedOn > today) throw new Error(`Line ${n}: purchase date can't be in the future.`);
    return {
      item,
      quantity: Math.round(quantity * 100) / 100,
      unitCost: Math.round(unitCost * 100) / 100,
      supplier: supplier ? supplier.slice(0, 120) : null,
      purchasedOn,
    };
  });
}

async function requireWorkableTicket(id: string) {
  const ticket = await getTicketStatus(id);
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.void) throw new Error("This ticket has been voided.");
  return ticket;
}

// Resolving a ticket always answers "what did it cost?" — either at least
// one purchase line, or an explicit "No purchase needed".
export async function resolveTicketAction(id: string, input: { lines: ExpenseLineInput[]; noPurchase: boolean }) {
  const session = await requireRole(MD_CAN_EDIT_TICKETS);
  await requireWorkableTicket(id);
  const lines = validateLines(input.lines ?? []);
  if (lines.length === 0 && !input.noPurchase) {
    throw new Error("Add what was bought, or tick 'No purchase needed'.");
  }
  if (lines.length > 0) {
    await addExpenses(id, lines, { staffId: session.staffId, name: session.displayName });
  } else {
    // A reopened ticket that already has purchases and needed nothing more
    // this time isn't a "no purchase" fix — leave its existing costs as-is.
    const existing = await getTicketExpenses(id);
    if (!existing.some((l) => !l.void)) await markNoPurchase(id, session.displayName);
  }
  await updateTicketStatus(id, "Resolved", session.displayName);
  revalidateAll();
}

// Adding purchases after the fact — a receipt that turned up late, or a
// ticket resolved from Duty Desk's side, which has no cost step.
export async function addTicketExpensesAction(id: string, input: ExpenseLineInput[]) {
  const session = await requireRole(MD_CAN_EDIT_TICKETS);
  await requireWorkableTicket(id);
  const lines = validateLines(input);
  if (lines.length === 0) throw new Error("Add at least one item.");
  await addExpenses(id, lines, { staffId: session.staffId, name: session.displayName });
  revalidateAll();
}

export async function voidExpenseAction(expenseId: string, reason: string) {
  const session = await requireRole(MD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a purchase line.");
  await voidExpense(expenseId, reason.trim(), session.displayName);
  revalidateAll();
}

export async function getTicketExpensesAction(id: string): Promise<ExpenseLine[]> {
  await requireSession();
  return getTicketExpenses(id);
}

export async function voidTicketAction(id: string, reason: string) {
  const session = await requireRole(MD_CAN_VOID);
  if (!reason.trim()) throw new Error("A reason is required to void a ticket.");
  await voidTicket(id, reason.trim(), session.displayName);
  revalidateAll();
}

export async function getTicketPhotosAction(id: string): Promise<string[]> {
  await requireSession();
  return getTicketPhotoUrls(id);
}
