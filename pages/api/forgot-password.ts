import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../lib/sendEmail";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Type the body with a type assertion
  const { email } = req.body as { email: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(200).end(); // always 200 for privacy

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 1000 * 60 * 30); // 30 min expiry
  await prisma.user.update({
    where: { email },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

    const resetUrl = `${process.env.AUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  await sendEmail(email, "Password Reset", `Reset your password: ${resetUrl}`);
  res.status(200).end();
}
