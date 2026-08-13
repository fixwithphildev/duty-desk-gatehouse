// Client-safe UI constants (option lists etc). Kept separate from
// src/lib/data/*.ts, which are server-only (they touch the Supabase
// service-role key) and must never be imported by a "use client" file.

export const GH_INCIDENT_CATEGORIES = ["Theft", "Disturbance", "Medical", "Trespassing", "Property Damage", "Other"];
export const GH_INCIDENT_STATUSES = ["Open", "In Progress", "Resolved"] as const;
export const GH_ALERT_TYPES = ["Fire", "Medical Emergency", "Security Breach", "Lockdown"];
