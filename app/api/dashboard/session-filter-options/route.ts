import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(_request: NextRequest) {
  const authSession = await getServerSession(authOptions);

  if (!authSession || !authSession.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = authSession.user.companyId;

  try {
    // Use groupBy for better performance with distinct values
    // Limit results to prevent unbounded queries
    const MAX_FILTER_OPTIONS = 1000;
    const [categoryGroups, languageGroups] = await Promise.all([
      prisma.session.groupBy({
        by: ["category"],
        where: {
          companyId,
          category: { not: null },
        },
        orderBy: {
          category: "asc",
        },
        take: MAX_FILTER_OPTIONS,
      }),
      prisma.session.groupBy({
        by: ["language"],
        where: {
          companyId,
          language: { not: null },
        },
        orderBy: {
          language: "asc",
        },
        take: MAX_FILTER_OPTIONS,
      }),
    ]);

    const distinctCategories = categoryGroups
      .map((g) => g.category)
      .filter(Boolean) as string[];

    const distinctLanguages = languageGroups
      .map((g) => g.language)
      .filter(Boolean) as string[];

    return NextResponse.json({
      categories: distinctCategories,
      languages: distinctLanguages,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      {
        error: "Failed to fetch filter options",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
