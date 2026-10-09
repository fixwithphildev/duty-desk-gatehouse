import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getVehicleLogsSince } from "@/lib/data/vehicles";
import { csvResponse, toCsv } from "@/lib/csv";

const TZ = "Africa/Lagos";
const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) : "");

// The vehicle log for the last day or week, as a spreadsheet.
export async function GET(req: NextRequest) {
  await requireSession();
  const days = req.nextUrl.searchParams.get("days") === "7" ? 7 : 1;
  const logs = await getVehicleLogsSince(new Date(Date.now() - days * 24 * 3600_000).toISOString(), 5000);
  const rows = logs.map((v) => ({
    card: v.card,
    plate: v.plate,
    driver: v.driver ?? "",
    in: local(v.entry_at),
    out: local(v.exit_at),
    status: v.void ? "Voided" : v.status === "Returned" ? "Returned" : "On property",
    logged_by: v.logged_by_name ?? "",
    out_by: v.exit_by_name ?? "",
    void_reason: v.void_reason ?? "",
  }));
  const csv = toCsv(rows, [
    { key: "card", label: "Card" },
    { key: "plate", label: "Plate" },
    { key: "driver", label: "Driver / purpose" },
    { key: "in", label: "In" },
    { key: "out", label: "Out" },
    { key: "status", label: "Status" },
    { key: "logged_by", label: "Logged in by" },
    { key: "out_by", label: "Logged out by" },
    { key: "void_reason", label: "Void reason" },
  ]);
  return csvResponse(csv, `gatehouse-vehicles-${days === 7 ? "7-days" : "24-hours"}-${new Date().toISOString().slice(0, 10)}.csv`);
}
