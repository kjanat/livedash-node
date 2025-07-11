import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { extractClientIP, InMemoryRateLimiter } from "../../../lib/rateLimiter";
import {
  AuditOutcome,
  createAuditMetadata,
  securityAuditLogger,
} from "../../../lib/securityAuditLogger";
import { sendEmail } from "../../../lib/sendEmail";
import { forgotPasswordSchema, validateInput } from "../../../lib/validation";

// Rate limiting for password reset endpoint
const passwordResetLimiter = new InMemoryRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxEntries: 10000,
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check using shared utility
    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    const rateLimitResult = passwordResetLimiter.checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
      await securityAuditLogger.logPasswordReset(
        "password_reset_rate_limited",
        AuditOutcome.RATE_LIMITED,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            resetTime: rateLimitResult.resetTime,
            maxAttempts: 5,
            windowMs: 15 * 60 * 1000,
          }),
        },
        "Password reset rate limit exceeded"
      );

      return NextResponse.json(
        {
          success: false,
          error: "Too many password reset attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateInput(forgotPasswordSchema, body);
    if (!validation.success) {
      await securityAuditLogger.logPasswordReset(
        "password_reset_invalid_input",
        AuditOutcome.FAILURE,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            error: "invalid_email_format",
          }),
        },
        "Invalid email format in password reset request"
      );

      return NextResponse.json(
        {
          success: false,
          error: "Invalid email format",
        },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success for privacy (don't reveal if email exists)
    // But only send email if user exists
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiry = new Date(Date.now() + 1000 * 60 * 30); // 30 min expiry

      await prisma.user.update({
        where: { email },
        data: { resetToken: tokenHash, resetTokenExpiry: expiry },
      });

      const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      await sendEmail({
        to: email,
        subject: "Password Reset",
        text: `Reset your password: ${resetUrl}`,
      });

      await securityAuditLogger.logPasswordReset(
        "password_reset_email_sent",
        AuditOutcome.SUCCESS,
        {
          userId: user.id,
          companyId: user.companyId,
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            email: "[REDACTED]",
            tokenExpiry: expiry.toISOString(),
          }),
        },
        "Password reset email sent successfully"
      );
    } else {
      // Log attempt for non-existent user
      await securityAuditLogger.logPasswordReset(
        "password_reset_user_not_found",
        AuditOutcome.FAILURE,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            email: "[REDACTED]",
          }),
        },
        "Password reset attempt for non-existent user"
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Forgot password error:", error);

    await securityAuditLogger.logPasswordReset(
      "password_reset_server_error",
      AuditOutcome.FAILURE,
      {
        ipAddress: extractClientIP(request),
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: createAuditMetadata({
          error: "server_error",
        }),
      },
      `Server error in password reset: ${error}`
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
