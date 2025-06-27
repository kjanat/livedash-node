import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";
import { SessionFilterOptions } from "../../../../lib/types";

export async function GET(request: NextRequest) {
  const authSession = await getServerSession(authOptions);

  if (!authSession || !authSession.user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({ 
      categories: distinctCategories, 
      languages: distinctLanguages 
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
