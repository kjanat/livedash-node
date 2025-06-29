import { hash } from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { platformAuthOptions } from "../../../../../../lib/platform-auth";
import { prisma } from "../../../../../../lib/prisma";

// POST /api/platform/companies/[id]/users - Invite user to company
export async function POST(
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

    const { id: companyId } = await params;
    const body = await request.json();
    const { name, email, role = "USER" } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { _count: { select: { users: true } } },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Check if user limit would be exceeded
    if (company._count.users >= company.maxUsers) {
      return NextResponse.json(
        { error: "Company has reached maximum user limit" },
        { status: 400 }
      );
    }

    // Check if user already exists in this company
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        companyId,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists in this company" },
        { status: 400 }
      );
    }

    // Generate a temporary password (in a real app, you'd send an invitation email)
    const tempPassword = `temp${Math.random().toString(36).slice(-8)}`;
    const hashedPassword = await hash(tempPassword, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        companyId,
        invitedBy: session.user.email,
        invitedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        invitedBy: true,
        invitedAt: true,
      },
    });

    // In a real application, you would send an email with login credentials
    // For now, we'll return the temporary password
    return NextResponse.json({
      user,
      tempPassword, // Remove this in production and send via email
      message:
        "User invited successfully. In production, credentials would be sent via email.",
    });
  } catch (error) {
    console.error("Platform user invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/platform/companies/[id]/users - Get company users
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(platformAuthOptions);

    if (!session?.user?.isPlatformUser) {
      return NextResponse.json(
        { error: "Platform access required" },
        { status: 401 }
      );
    }

    const { id: companyId } = await params;

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        invitedBy: true,
        invitedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Platform users list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
