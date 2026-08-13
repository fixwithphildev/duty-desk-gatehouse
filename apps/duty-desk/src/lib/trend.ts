import "server-only";

export interface DailyCount {
  date: string;
  value: number;
}

// Buckets a list of ISO timestamps into a fixed-length series of the last
// `days` calendar days (including empty days at 0), oldest first — the
// shape TrendChart expects.
export function bucketByDay(timestamps: string[], days: number): DailyCount[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}
