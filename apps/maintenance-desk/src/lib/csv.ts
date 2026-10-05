import "server-only";

// Same CSV helpers as Duty Desk's src/lib/csv.ts, plus a UTF-8 byte-order
// mark: without it Excel on Windows guesses the wrong encoding and mangles
// non-ASCII text (names, the ₦ sign) in the downloaded report.

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: { key: keyof T; label: string }[]): string {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvValue(row[c.key])).join(",")).join("\r\n");
  return `${header}\r\n${body}\r\n`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
