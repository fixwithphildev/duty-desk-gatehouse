import "server-only";

// The database hands back at most 1,000 rows per request, so a list that keeps
// growing (every checklist ever submitted) is read 1,000 at a time. The query
// must have a stable order, or rows can be skipped between pages.
const PAGE = 1000;

export async function allRows(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
