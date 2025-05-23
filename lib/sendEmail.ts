export async function sendEmail(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  // For demo: log to console. Use nodemailer/sendgrid/whatever in prod.
  process.stdout.write(`[Email to ${to}]: ${subject}\n${text}\n`);
}
