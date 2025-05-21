// API endpoint: update company CSV URL config
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { prisma } from "../../../lib/prisma";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Not logged in" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
  });

  if (!user) return res.status(401).json({ error: "No user" });

  if (req.method === "POST") {
    const { csvUrl } = req.body;
    await prisma.company.update({
      where: { id: user.companyId },
      data: { csvUrl },
    });
    res.json({ ok: true });
  } else {
    res.status(405).end();
  }
}
