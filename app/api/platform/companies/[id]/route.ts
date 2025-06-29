import { CompanyStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { platformAuthOptions } from "../../../../../lib/platform-auth";
import { prisma } from "../../../../../lib/prisma";

interface PlatformSession {
  user: {
    id?: string;
    name?: string;
    email?: string;
    isPlatformUser?: boolean;
    platformRole?: string;
  };
}

// GET /api/platform/companies/[id] - Get company details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = (await getServerSession(
      platformAuthOptions
    )) as PlatformSession | null;

    if (!session?.user?.isPlatformUser) {
      return NextResponse.json(
        { error: "Platform access required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            invitedBy: true,
            invitedAt: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            imports: true,
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Platform company details error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/platform/companies/[id] - Update company
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(platformAuthOptions);

    if (
      !session?.user?.isPlatformUser ||
      session.user.platformRole === "SUPPORT"
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, maxUsers, csvUrl, csvUsername, csvPassword, status } =
      body;

    const updateData: {
      name?: string;
      email?: string;
      maxUsers?: number;
      csvUrl?: string;
      csvUsername?: string;
      csvPassword?: string;
      status?: CompanyStatus;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (maxUsers !== undefined) updateData.maxUsers = maxUsers;
    if (csvUrl !== undefined) updateData.csvUrl = csvUrl;
    if (csvUsername !== undefined) updateData.csvUsername = csvUsername;
    if (csvPassword !== undefined) updateData.csvPassword = csvPassword;
    if (status !== undefined) updateData.status = status;

    const company = await prisma.company.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ company });
  } catch (error) {
    console.error("Platform company update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/platform/companies/[id] - Delete company (archives instead)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(platformAuthOptions);

    if (
      !session?.user?.isPlatformUser ||
      session.user.platformRole !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Super admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Archive instead of delete to preserve data integrity
    const company = await prisma.company.update({
      where: { id },
      data: { status: CompanyStatus.ARCHIVED },
    });

    return NextResponse.json({ company });
  } catch (error) {
    console.error("Platform company archive error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
