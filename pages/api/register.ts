import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import { ApiResponse } from "../../lib/types";

interface RegisterRequestBody {
  email: string;
  password: string;
  company: string;
  csvUrl?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ success: boolean } | { error: string }>>,
) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, password, company, csvUrl } = req.body as RegisterRequestBody;

  if (!email || !password || !company) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
    });
  }

  // Check if email exists
  const exists = await prisma.user.findUnique({
    where: { email },
  });

  if (exists) {
    return res.status(409).json({
      success: false,
      error: "Email already exists",
    });
  }

  const newCompany = await prisma.company.create({
    data: { name: company, csvUrl: csvUrl || "" },
  });
  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      password: hashed,
      companyId: newCompany.id,
      role: "admin",
    },
  });
  res.status(201).json({
    success: true,
    data: { success: true },
  });
}
