import { NextApiRequest, NextApiResponse } from "next";
import { getApiSession } from "../../../lib/api-auth";
import { prisma } from "../../../lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const session = await getApiSession(req, res);
  if (!session?.user || session.user.role !== "admin")
    return res.status(403).json({ error: "Forbidden" });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
  });

  if (!user) return res.status(401).json({ error: "No user" });

  if (req.method === "POST") {
    const { csvUrl, csvUsername, csvPassword, sentimentThreshold } = req.body;
    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        csvUrl,
        csvUsername,
        ...(csvPassword ? { csvPassword } : {}),
        sentimentAlert: sentimentThreshold
          ? parseFloat(sentimentThreshold)
          : null,
      },
    });
    res.json({ ok: true });
  } else {
    res.status(405).end();
  }
}
