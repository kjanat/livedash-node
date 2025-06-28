import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { platformAuthOptions } from "../../../../lib/platform-auth";
import { prisma } from "../../../../lib/prisma";
import { CompanyStatus } from "@prisma/client";

// GET /api/platform/companies - List all companies
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(platformAuthOptions);

    if (!session?.user?.isPlatformUser) {
      return NextResponse.json({ error: "Platform access required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as CompanyStatus | null;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          maxUsers: true,
          _count: {
            select: {
              sessions: true,
              imports: true,
              users: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({
      companies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Platform companies list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/platform/companies - Create new company
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(platformAuthOptions);

    if (!session?.user?.isPlatformUser || session.user.platformRole === "SUPPORT") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, 
      csvUrl, 
      csvUsername, 
      csvPassword, 
      adminEmail,
      adminName,
      adminPassword,
      maxUsers = 10,
      status = "TRIAL" 
    } = body;

    if (!name || !csvUrl) {
      return NextResponse.json({ error: "Name and CSV URL required" }, { status: 400 });
    }

    if (!adminEmail || !adminName) {
      return NextResponse.json({ error: "Admin email and name required" }, { status: 400 });
    }

    // Generate password if not provided
    const finalAdminPassword = adminPassword || `Temp${Math.random().toString(36).slice(2, 8)}!`;

    // Hash the admin password
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(finalAdminPassword, 12);

    // Create company and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the company
      const company = await tx.company.create({
        data: {
          name,
          csvUrl,
          csvUsername: csvUsername || null,
          csvPassword: csvPassword || null,
          maxUsers,
          status,
        },
      });

      // Create the admin user
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName,
          role: "ADMIN",
          companyId: company.id,
          invitedBy: session.user.email || "platform",
          invitedAt: new Date(),
        },
      });

      return { company, adminUser, generatedPassword: adminPassword ? null : finalAdminPassword };
    });

    return NextResponse.json({ 
      company: result.company,
      adminUser: {
        email: result.adminUser.email,
        name: result.adminUser.name,
        role: result.adminUser.role,
      },
      generatedPassword: result.generatedPassword,
    }, { status: 201 });
  } catch (error) {
    console.error("Platform company creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}