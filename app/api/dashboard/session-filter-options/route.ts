import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { SessionFilterOptions } from "../../../../lib/types";

export async function GET(request: NextRequest) {
  const authSession = await getServerSession(authOptions);

  if (!authSession || !authSession.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = authSession.user.companyId;

  try {
    // Use groupBy for better performance with distinct values
    const [categoryGroups, languageGroups] = await Promise.all([
      prisma.session.groupBy({
        by: ['category'],
        where: {
          companyId,
          category: { not: null },
        },
        orderBy: {
          category: 'asc',
        },
      }),
      prisma.session.groupBy({
        by: ['language'],
        where: {
          companyId,
          language: { not: null },
        },
        orderBy: {
          language: 'asc',
        },
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
