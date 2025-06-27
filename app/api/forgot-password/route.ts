import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { sendEmail } from "../../../lib/sendEmail";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body as { email: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Always return 200 for privacy (don't reveal if email exists)
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 1000 * 60 * 30); // 30 min expiry
  
  await prisma.user.update({
    where: { email },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  await sendEmail(email, "Password Reset", `Reset your password: ${resetUrl}`);
  
  return NextResponse.json({ success: true }, { status: 200 });
}
