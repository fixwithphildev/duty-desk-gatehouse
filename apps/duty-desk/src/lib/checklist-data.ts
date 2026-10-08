export interface ChecklistCategory {
  key: string;
  label: string;
  kind: "condition" | "yesno";
  items: string[];
}

// Matches the real "Destination Apartment Checklist" paper form (73 numbered
// lines). Three of those lines — Remotes, Toiletries, Towels — are group
// headers on paper that each cover several individual Yes/No checks, so
// digitized one-checkbox-per-check this comes out to 84 items, not 73.
const QTY_ITEMS = new Set([
  "Available Pillows", "Balcony Chairs", "Hangers", "Laundry Bags", "White Bedside Stool", "Extension Boxes",
  "Dinner Plates", "Dinner Mini Plates", "Soup Bowls", "Dinner Spoons", "Dinner Forks", "Tea Spoons",
  "Dinner Knives", "Mugs", "Tea Cups", "Water Glass", "Highball (Wine) Cups", "Washing Hand Bowls",
  "Washing Hand Bowls (Bathroom)", "Pots", "Frying Pan", "Set of Cooking Ladles", "Set of Kitchen Knives",
]);

export const DD_CATEGORIES: ChecklistCategory[] = [
  {
    key: "room",
    label: "Room & Living",
    kind: "condition",
    items: [
      "Bed Condition", "Apartment Fragrance", "Art Works", "Condition of the Couch", "TV Position",
      "TV Console Condition", "Available Pillows", "Beddings Cleanliness", "Dining Chairs Condition",
      "Working Pop Lights", "Washing Machine", "White Bedside Stool", "Balcony Table", "Balcony Chairs",
      "Bedside Drawer Charger", "AC Units Condition", "Sitting Room Fancy Chair", "Workstation Table",
      "Workstation Chair", "Available Rug / Cleanliness", "Wall Console", "Dining Table", "Hangers",
      "Floor Skirting", "Laundry Bags", "Décor", "Curtains / Blinds", "Hallway Lights", "Hallway Rugs",
      "Wall Cleanliness", "Surroundings / Garden", "All Doors Condition", "Balcony Cleanliness",
      "Balcony Glass Cleanliness", "Recess Light", "Extension Boxes", "Studio Work Station",
    ],
  },
  {
    key: "kitchen",
    label: "Kitchen & Dining",
    kind: "condition",
    items: [
      "Refrigerator Condition", "Microwave Condition", "Electric Kettle", "Gas Availability",
      "Dinner Plates", "Dinner Mini Plates", "Soup Bowls", "Dinner Spoons", "Dinner Forks", "Tea Spoons",
      "Dinner Knives", "Mugs", "Tea Cups", "Water Glass", "Highball (Wine) Cups", "Washing Hand Bowls",
      "Pots", "Frying Pan", "Set of Cooking Ladles", "Set of Kitchen Knives", "Kitchen Heat Extractor",
      "Blender", "Kitchen Cabinet",
    ],
  },
  {
    key: "bathroom",
    label: "Bathroom",
    kind: "condition",
    items: [
      "Bath Robe", "Bath Glass Cleanliness", "Shower Heads", "Shower Cubicle", "Toilet Seats", "Taps",
      "Bathroom Shelves", "Washing Hand Bowls (Bathroom)",
    ],
  },
  {
    key: "electronics",
    label: "Electronics & Remotes",
    kind: "yesno",
    items: [
      "MiFi Available", "Window Blind Remote", "TV Remotes", "IPTV Available",
      "A/C Remote (Sitting Room)", "A/C Remote (Bedroom)", "IPTV Remote",
    ],
  },
  {
    key: "toiletries",
    label: "Toiletries & Utilities",
    kind: "yesno",
    items: [
      "Tissue", "Shampoo", "Bath Gel / Soap", "Body Towels", "Shaving Kit", "Hand Towel",
      "Dental Kit", "Shower Cap", "Bottle Water Available",
    ],
  },
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
// Teams a complaint can be assigned to: the Resident Officers themselves, or a maintenance department.
export const DD_COMPLAINT_TEAMS = ["Resident Officers", ...DD_TICKET_DEPTS];
export const DD_TICKET_STATUSES = ["Reported", "In Progress", "Resolved"] as const;

// Best-effort split for tickets auto-created from a flagged checklist item:
// fixed equipment/electrical/plumbing/HVAC needs a technician (Engineering);
// everything else — furnishings, linens, tableware, cleanliness — needs
// housekeeping to clean or restock, so that's the default for any item not
// listed here. Adjust individual items below if this doesn't match how your
// teams actually split the work.
export const DD_ENGINEERING_ITEMS = new Set([
  "TV Position", "Working Pop Lights", "Washing Machine", "Bedside Drawer Charger", "AC Units Condition",
  "Floor Skirting", "Hallway Lights", "Surroundings / Garden", "All Doors Condition", "Recess Light",
  "Extension Boxes",
  "Refrigerator Condition", "Microwave Condition", "Electric Kettle", "Gas Availability",
  "Kitchen Heat Extractor", "Blender", "Kitchen Cabinet",
  "Shower Heads", "Shower Cubicle", "Toilet Seats", "Taps",
]);

export function ticketDeptFor(itemName: string): "Engineering" | "Housekeeping" {
  return DD_ENGINEERING_ITEMS.has(itemName) ? "Engineering" : "Housekeeping";
}

export function priorityTone(p: string): string {
  return p === "High" ? "red" : p === "Medium" ? "gold" : "teal";
}
export function conditionTone(c: string | null): string {
  return c === "Good" ? "teal" : c === "Damaged" || c === "Missing" ? "red" : "neutral";
}
