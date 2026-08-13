"use server";

import { requirePageAccess } from "@/lib/auth";
import { buildReportCsv, REPORT_DATASET_LABELS, type ReportDataset } from "@/lib/reports/exports";
import { sendCsvEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function emailReportAction(dataset: ReportDataset, toEmail: string): Promise<void> {
  const session = await requirePageAccess("/reports");
  const to = toEmail.trim();
  if (!EMAIL_RE.test(to)) throw new Error("Enter a valid email address.");

  const { csv, filename } = await buildReportCsv(dataset);
  await sendCsvEmail({
    to,
    subject: `Gatehouse — ${REPORT_DATASET_LABELS[dataset]} report`,
    body: `Attached: the ${REPORT_DATASET_LABELS[dataset]} report, sent by ${session.displayName} from Gatehouse.`,
    csv,
    filename,
  });
}
