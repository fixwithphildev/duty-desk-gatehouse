// Calendar periods in Lagos time, as YYYY-MM-DD strings (purchases are
// counted by the day they were bought).
const TZ = "Africa/Lagos";
export const lagosToday = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

const addDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Monday to Sunday of this week.
export function thisWeek(today = lagosToday()): { from: string; to: string } {
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const from = addDays(today, -dow);
  return { from, to: addDays(from, 6) };
}

export function thisMonth(today = lagosToday()): { from: string; to: string; name: string } {
  const from = today.slice(0, 8) + "01";
  const d = new Date(from + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { from, to: d.toISOString().slice(0, 10), name: new Date(from + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }) };
}

export const weekDays = (from: string) => Array.from({ length: 7 }, (_, i) => addDays(from, i));

// "06 Oct"
export const shortDate = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
