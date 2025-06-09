import { NextApiRequest, NextApiResponse } from "next";
import { getApiSession } from "../../../lib/api-auth";
import { prisma } from "../../../lib/prisma";
import { SessionFilterOptions } from "../../../lib/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    SessionFilterOptions | { error: string; details?: string }
  >
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

    const authSession = await getApiSession(req, res);

  if (!authSession || !authSession.user?.companyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const companyId = authSession.user.companyId;

  try {
    const categories = await prisma.session.findMany({
      where: {
        companyId,
        category: {
          not: null, // Ensure category is not null
        },
      },
      distinct: ["category"],
      select: {
        category: true,
      },
      orderBy: {
        category: "asc",
      },
    });

    const languages = await prisma.session.findMany({
      where: {
        companyId,
        language: {
          not: null, // Ensure language is not null
        },
      },
      distinct: ["language"],
      select: {
        language: true,
      },
      orderBy: {
        language: "asc",
      },
    });

    const distinctCategories = categories
      .map((s) => s.category)
      .filter(Boolean) as string[]; // Filter out any nulls and assert as string[]
    const distinctLanguages = languages
      .map((s) => s.language)
      .filter(Boolean) as string[]; // Filter out any nulls and assert as string[]

    return res
      .status(200)
      .json({ categories: distinctCategories, languages: distinctLanguages });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return res.status(500).json({
      error: "Failed to fetch filter options",
      details: errorMessage,
    });
  }
}
