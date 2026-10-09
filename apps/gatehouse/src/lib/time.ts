// Dates and times as people at the property read them: Lagos time, short and plain.
const TZ = "Africa/Lagos";

const dayKey = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

// "Today 08:12", "Yesterday 16:40", "Mon 5 Oct, 14:00"
export function whenText(iso: string): string {
  const d = new Date(iso), now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(d) === dayKey(now)) return `Today ${clockTime(iso)}`;
  if (dayKey(d) === dayKey(yesterday)) return `Yesterday ${clockTime(iso)}`;
  return `${dayText(iso)}, ${clockTime(iso)}`;
}

// "Mon 5 Oct"
export function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
}

// Whole days between then and now (0 = today).
export function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

// "A. Okafor"
export function shortName(name: string): string {
  const w = name.trim().split(/\s+/);
  return w.length > 1 ? `${w[0][0]}. ${w.slice(1).join(" ")}` : name;
}

// The hour in Lagos now, or at a given time.
export function lagosHour(iso?: string): number {
  return Number((iso ? new Date(iso) : new Date()).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ })) % 24;
}

// "Thursday 8 October"
export function todayLong(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

// "2026-10-08" in Lagos, for grouping by day.
export function lagosDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

// "2h", "3d"
export function ageText(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}
