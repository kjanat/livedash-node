import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import type { NextApiRequest, NextApiResponse } from "next"; // Import official Next.js types

export default async function handler(
  req: NextApiRequest, // Use official NextApiRequest
  res: NextApiResponse // Use official NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]); // Good practice to set Allow header for 405
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // It's good practice to explicitly type the expected body for clarity and safety
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    return res.status(400).json({ error: "Token and password are required." });
  }

  if (password.length < 8) {
    // Example: Add password complexity rule
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters long." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid or expired token. Please request a new password reset.",
      });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Instead of just res.status(200).end(), send a success message
    return res
      .status(200)
      .json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("Reset password error:", error); // Log the error for server-side debugging
    // Provide a generic error message to the client
    return res.status(500).json({
      error: "An internal server error occurred. Please try again later.",
    });
  }
}
