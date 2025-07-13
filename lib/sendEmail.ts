import { InMemoryRateLimiter } from "./rateLimiter";

export interface EmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const emailRateLimit = new InMemoryRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 1000,
  maxEntries: 1000,
});

export async function sendEmail(
  options: EmailOptions
): Promise<{ success: boolean; error?: string }> {
  const rateLimitCheck = emailRateLimit.checkRateLimit(options.to);
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      error: "Rate limit exceeded. Please try again later.",
    };
  }

  const config = getEmailConfig();
  if (!config.isConfigured) {
    console.warn("Email not configured - would send:", options);
    return {
      success: false,
      error: "Email service not configured",
    };
  }

  try {
    if (process.env.NODE_ENV === "development") {
      console.log("📧 [DEV] Email would be sent:", {
        to: options.to,
        subject: options.subject,
        text: `${options.text?.substring(0, 100)}...`,
      });
      return { success: true };
    }

    await sendEmailViaService(options, config);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send email:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function getEmailConfig(): EmailConfig & { isConfigured: boolean } {
  const config = {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT
      ? Number.parseInt(process.env.SMTP_PORT)
      : 587,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    fromEmail: process.env.FROM_EMAIL || "noreply@livedash.app",
    fromName: process.env.FROM_NAME || "LiveDash",
  };

  const isConfigured = !!(
    config.smtpHost &&
    config.smtpUser &&
    config.smtpPassword
  );

  return { ...config, isConfigured };
}

async function sendEmailViaService(
  _options: EmailOptions,
  _config: EmailConfig
): Promise<void> {
  throw new Error(
    "Email service implementation required - install nodemailer or similar SMTP library"
  );
}

export async function sendPasswordResetEmail(
  email: string,
  tempPassword: string
): Promise<{ success: boolean; error?: string }> {
  const subject = "Your temporary password - LiveDash";
  const text = `Your temporary password is: ${tempPassword}\n\nPlease log in and change your password immediately for security.`;
  const html = `
    <h2>Temporary Password</h2>
    <p>Your temporary password is: <strong>${tempPassword}</strong></p>
    <p>Please log in and change your password immediately for security.</p>
    <p><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login">Login here</a></p>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

// Legacy function for backward compatibility
export async function sendEmailLegacy(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  process.stdout.write(`[Email to ${to}]: ${subject}\n${text}\n`);
}
