import "server-only";
import { Resend } from "resend";

function getClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email isn't configured yet — RESEND_API_KEY is missing. See SETUP.md.");
  return new Resend(key);
}

export async function sendCsvEmail(params: { to: string; subject: string; csv: string; filename: string; body: string }): Promise<void> {
  const resend = getClient();
  const from = process.env.REPORTS_FROM_EMAIL || "onboarding@resend.dev";

  const { error } = await resend.emails.send({
    from: `Duty Desk <${from}>`,
    to: params.to,
    subject: params.subject,
    text: params.body,
    attachments: [{ filename: params.filename, content: Buffer.from(params.csv, "utf-8") }],
  });
  if (error) throw new Error(error.message);
}
