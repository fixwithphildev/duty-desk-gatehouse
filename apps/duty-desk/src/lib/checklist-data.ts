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
// Where a repair ticket goes: one of Maintenance Desk's six units, or ICT or
// Housekeeping (both handled inside Duty Desk). Older tickets may say "Engineering".
export const DD_MAINTENANCE_UNITS = ["General Maintenance", "Electrician", "Plumbing & Building", "Painting", "Welding", "HVAC"];
export const DD_TICKET_DEPTS = [...DD_MAINTENANCE_UNITS, "ICT", "Housekeeping"];
// Teams a complaint can be assigned to: the Resident Officers themselves, or a maintenance department.
export const DD_COMPLAINT_TEAMS = ["Resident Officers", ...DD_TICKET_DEPTS];
export const DD_TICKET_STATUSES = ["Reported", "In Progress", "Resolved"] as const;
// Most reasons an officer gives at once when putting an apartment under maintenance; the
// photos all travel in one upload.
export const DD_MAX_MAINTENANCE_REASONS = 6;

// Which department a flagged checklist item usually goes to (the officer can
// choose another on the item). Fixed equipment goes to the maintenance unit
// that repairs it, air conditioning to HVAC, TV, IPTV and internet to ICT;
// everything else (furnishings, linens, tableware, cleanliness) goes to
// Housekeeping to clean or restock. Adjust items here if the split changes.
export const DD_ITEM_UNIT: Record<string, string> = {
  "TV Position": "General Maintenance", "Working Pop Lights": "Electrician", "Washing Machine": "Electrician",
  "Bedside Drawer Charger": "Electrician", "AC Units Condition": "HVAC", "Floor Skirting": "Plumbing & Building",
  "A/C Remote (Sitting Room)": "HVAC", "A/C Remote (Bedroom)": "HVAC",
  "MiFi Available": "ICT", "IPTV Available": "ICT", "IPTV Remote": "ICT", "TV Remotes": "ICT",
  "Hallway Lights": "Electrician", "Surroundings / Garden": "General Maintenance", "All Doors Condition": "General Maintenance",
  "Recess Light": "Electrician", "Extension Boxes": "Electrician", "Refrigerator Condition": "Electrician",
  "Microwave Condition": "Electrician", "Electric Kettle": "Electrician", "Gas Availability": "General Maintenance",
  "Kitchen Heat Extractor": "Electrician", "Blender": "Electrician", "Kitchen Cabinet": "General Maintenance",
  "Shower Heads": "Plumbing & Building", "Shower Cubicle": "Plumbing & Building", "Toilet Seats": "Plumbing & Building",
  "Taps": "Plumbing & Building",
};

export function ticketDeptFor(itemName: string): string {
  return DD_ITEM_UNIT[itemName] ?? "Housekeeping";
}

export function priorityTone(p: string): string {
  return p === "High" ? "red" : p === "Medium" ? "gold" : "teal";
}
export function conditionTone(c: string | null): string {
  return c === "Good" ? "teal" : c === "Damaged" || c === "Missing" ? "red" : "neutral";
}
