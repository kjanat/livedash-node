import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { extractClientIP, InMemoryRateLimiter } from "../../../lib/rateLimiter";
import { registerSchema, validateInput } from "../../../lib/validation";

// Rate limiting for registration endpoint
const registrationLimiter = new InMemoryRateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  maxEntries: 10000,
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check using shared utility
    const ip = extractClientIP(request);
    const rateLimitResult = registrationLimiter.checkRateLimit(ip);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many registration attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate input with Zod schema
    const validation = validateInput(registerSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { email, password, company } = validation.data;

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Email already exists",
        },
        { status: 409 }
      );
    }

    // Check if company name already exists
    const existingCompany = await prisma.company.findFirst({
      where: { name: company },
    });

    if (existingCompany) {
      return NextResponse.json(
        {
          success: false,
          error: "Company name already exists",
        },
        { status: 409 }
      );
    }

    // Create company and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          name: company,
          csvUrl: "", // Empty by default, can be set later in settings
        },
      });

      const hashedPassword = await bcrypt.hash(password, 12); // Increased rounds for better security

      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          companyId: newCompany.id,
          role: "USER", // Changed from ADMIN - users should be promoted by existing admins
        },
      });

      return { company: newCompany, user: newUser };
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Registration successful",
          userId: result.user.id,
          companyId: result.company.id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
