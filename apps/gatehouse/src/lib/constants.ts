// Client-safe option lists. Kept separate from src/lib/data/*.ts, which are
// server-only (they hold the Supabase service-role key) and must never be
// imported by a "use client" file.

export const GH_INCIDENT_CATEGORIES = ["Theft", "Disturbance", "Medical", "Trespassing", "Property Damage", "Other"];
export const GH_ALERT_TYPES = ["Fire", "Medical Emergency", "Security Breach", "Lockdown"];

// Places officers often name, offered as suggestions (anything can be typed).
export const GH_PLACES = ["Main gate", "Back gate", "Car park", "Lobby", "Pool deck", "Generator house", "Office block", "Staff quarters", "Main Building", "Studio Wings"];
