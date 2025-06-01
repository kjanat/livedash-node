// API endpoint: update company CSV URL config
import { NextApiRequest, NextApiResponse } from "next";
import { getApiSession } from "../../../lib/api-auth";
import { prisma } from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const session = await getApiSession(req, res);
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
  } else if (req.method === "GET") {
    // Get company data
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
    });
    res.json({ company });
  } else {
    res.status(405).end();
  }
}
