import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { sendEmail } from "../../../lib/sendEmail";
import { forgotPasswordSchema, validateInput } from "../../../lib/validation";

// In-memory rate limiting with automatic cleanup
const resetAttempts = new Map<string, { count: number; resetTime: number }>();
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_ENTRIES = 10000;

setInterval(() => {
  const now = Date.now();
  resetAttempts.forEach((attempts, ip) => {
    if (now > attempts.resetTime) {
      resetAttempts.delete(ip);
    }
  });
}, CLEANUP_INTERVAL);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // Prevent unbounded growth
  if (resetAttempts.size > MAX_ENTRIES) {
    const entries = Array.from(resetAttempts.entries());
    entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
    entries.slice(0, Math.floor(MAX_ENTRIES / 2)).forEach(([ip]) => {
      resetAttempts.delete(ip);
    });
  }
  const attempts = resetAttempts.get(ip);

  if (!attempts || now > attempts.resetTime) {
    resetAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 minute window
    return true;
  }

  if (attempts.count >= 5) {
    // Max 5 reset requests per 15 minutes per IP
    return false;
  }

  attempts.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(ip)) {
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
      await sendEmail(
        email,
        "Password Reset",
        `Reset your password: ${resetUrl}`
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
