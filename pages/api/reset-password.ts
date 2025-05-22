import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import type { IncomingMessage, ServerResponse } from "http";

type NextApiRequest = IncomingMessage & {
  body: {
    token: string;
    password: string;
    [key: string]: unknown;
  };
};

type NextApiResponse = ServerResponse & {
  status: (code: number) => NextApiResponse;
  json: (data: Record<string, unknown>) => void;
  end: () => void;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();
  const { token, password } = req.body;
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gte: new Date() },
    },
  });
  if (!user) return res.status(400).json({ error: "Invalid or expired token" });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
  res.status(200).end();
}
