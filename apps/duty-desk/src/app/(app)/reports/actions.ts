"use server";

import { guarded } from "@/lib/action";
import { requirePageAccess } from "@/lib/auth";
import { buildReportCsv, REPORT_DATASET_LABELS, type ReportDataset } from "@/lib/reports/exports";
import { sendCsvEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function emailReportAction__run(dataset: ReportDataset, toEmail: string): Promise<void> {
  const session = await requirePageAccess("/reports");
  const to = toEmail.trim();
  if (!EMAIL_RE.test(to)) throw new Error("Enter a valid email address.");

  const { csv, filename } = await buildReportCsv(dataset);
  await sendCsvEmail({
    to,
    subject: `Duty Desk — ${REPORT_DATASET_LABELS[dataset]} report`,
    body: `Attached: the ${REPORT_DATASET_LABELS[dataset]} report, sent by ${session.displayName} from Duty Desk.`,
    csv,
    filename,
  });
}

export async function emailReportAction(...args: Parameters<typeof emailReportAction__run>) {
  return guarded(() => emailReportAction__run(...args));
}
