import { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { getApiSession } from "../../../lib/api-auth";
// User type from prisma is used instead of the one in lib/types

interface UserBasicInfo {
  id: string;
  email: string;
  role: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const session = await getApiSession(req, res);
    console.log("Session in users API:", session);

    if (!session?.user) {
        console.log("No session or user found");
        return res.status(401).json({ error: "Not logged in" });
    }

    if (session.user.role !== "admin") {
        console.log("User is not admin:", session.user.role);
        return res.status(403).json({ error: "Admin access required" });
    }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
  });

  if (!user) return res.status(401).json({ error: "No user" });

  if (req.method === "GET") {
    const users = await prisma.user.findMany({
      where: { companyId: user.companyId },
    });

    const mappedUsers: UserBasicInfo[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
    }));

    res.json({ users: mappedUsers });
  } else if (req.method === "POST") {
    const { email, role } = req.body;
    if (!email || !role)
      return res.status(400).json({ error: "Missing fields" });
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email exists" });
    const tempPassword = crypto.randomBytes(12).toString("base64").slice(0, 12); // secure random initial password
    await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(tempPassword, 10),
        companyId: user.companyId,
        role,
      },
    });
    // TODO: Email user their temp password (stub, for demo) - Implement a robust and secure email sending mechanism. Consider using a transactional email service.
    res.json({ ok: true, tempPassword });
  } else res.status(405).end();
}
