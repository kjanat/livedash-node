import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { extractClientIP } from "../../../lib/rateLimiter";
import {
  AuditOutcome,
  createAuditMetadata,
  securityAuditLogger,
} from "../../../lib/securityAuditLogger";
import { resetPasswordSchema, validateInput } from "../../../lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent") || undefined;
    const body = await request.json();

    // Validate input with strong password requirements
    const validation = validateInput(resetPasswordSchema, body);
    if (!validation.success) {
      await securityAuditLogger.logPasswordReset(
        "password_reset_validation_failed",
        AuditOutcome.FAILURE,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            error: "validation_failed",
            validationErrors: validation.errors,
          }),
        },
        "Password reset validation failed"
      );

      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      await securityAuditLogger.logPasswordReset(
        "password_reset_invalid_token",
        AuditOutcome.FAILURE,
        {
          ipAddress: ip,
          userAgent,
          metadata: createAuditMetadata({
            error: "invalid_or_expired_token",
          }),
        },
        "Password reset attempt with invalid or expired token"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired token. Please request a new password reset.",
        },
        { status: 400 }
      );
    }

    // Hash password with higher rounds for better security
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    await securityAuditLogger.logPasswordReset(
      "password_reset_completed",
      AuditOutcome.SUCCESS,
      {
        userId: user.id,
        companyId: user.companyId,
        ipAddress: ip,
        userAgent,
        metadata: createAuditMetadata({
          email: "[REDACTED]",
          passwordChanged: true,
        }),
      },
      "Password reset completed successfully"
    );

    return NextResponse.json(
      {
        success: true,
        message: "Password has been reset successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);

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
      `Server error in password reset completion: ${error}`
    );

    return NextResponse.json(
      {
        success: false,
        error: "An internal server error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
