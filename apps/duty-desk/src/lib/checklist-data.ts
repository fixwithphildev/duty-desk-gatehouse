export interface ChecklistCategory {
  key: string;
  label: string;
  kind: "condition" | "yesno";
  items: string[];
}

const QTY_ITEMS = new Set([
  "Frying Pan", "Pots", "Tea Cups", "Mugs", "Dinner Plates", "Soup Bowls", "Available Pillows", "Hangers",
]);

export const DD_CATEGORIES: ChecklistCategory[] = [
  { key: "room", label: "Room & Living", kind: "condition", items: ["Bed Condition", "Apartment Fragrance", "Condition of the Couch", "TV Condition", "Available Pillows", "Curtains / Blinds", "AC Units Condition", "Balcony Condition"] },
  { key: "kitchen", label: "Kitchen & Dining", kind: "condition", items: ["Frying Pan", "Pots", "Tea Cups", "Mugs", "Dinner Plates", "Soup Bowls", "Gas Availability", "Refrigerator Condition"] },
  { key: "bathroom", label: "Bathroom", kind: "condition", items: ["Bath Robe", "Shower Heads", "Toilet Seats", "Taps"] },
  { key: "electronics", label: "Electronics & Remotes", kind: "yesno", items: ["TV Remotes", "A/C Remote (Bedroom)", "MiFi Available"] },
  { key: "toiletries", label: "Toiletries & Utilities", kind: "yesno", items: ["Tissue", "Body Towels", "Bottle Water Available"] },
];

export interface ChecklistItemDef {
  name: string;
  category: string;
  categoryLabel: string;
  kind: "condition" | "yesno";
  hasQty: boolean;
}

export const DD_ALL_ITEMS: ChecklistItemDef[] = DD_CATEGORIES.flatMap((c) =>
  c.items.map((name) => ({ name, category: c.key, categoryLabel: c.label, kind: c.kind, hasQty: QTY_ITEMS.has(name) }))
);

export const DD_CHECKLIST_TYPES: { value: "check_in_prep" | "check_out_inspection"; label: string }[] = [
  { value: "check_in_prep", label: "Check-in Prep" },
  { value: "check_out_inspection", label: "Check-out Inspection" },
];

export const DD_CONDITIONS = ["Good", "Damaged", "Missing", "N/A"] as const;
export const DD_COMPLAINT_CATEGORIES = ["Noise", "Cleanliness", "Service", "Billing", "Other"];
export const DD_PRIORITIES = ["Low", "Medium", "High"] as const;
export const DD_COMPLAINT_STATUSES = ["Open", "In Progress", "Resolved"] as const;
export const DD_TICKET_DEPTS = ["Engineering", "Housekeeping", "General Maintenance"];
export const DD_TICKET_STATUSES = ["Reported", "In Progress", "Resolved"] as const;

export function priorityTone(p: string): string {
  return p === "High" ? "red" : p === "Medium" ? "gold" : "teal";
}
export function conditionTone(c: string | null): string {
  return c === "Good" ? "teal" : c === "Damaged" || c === "Missing" ? "red" : "neutral";
}
