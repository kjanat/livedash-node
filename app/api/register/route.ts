import bcrypt from "bcryptjs";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { registerSchema, validateInput } from "../../../lib/validation";

// In-memory rate limiting with automatic cleanup
const registrationAttempts = new Map<
  string,
  { count: number; resetTime: number }
>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_ENTRIES = 10000; // Prevent unbounded growth

setInterval(() => {
  const now = Date.now();
  registrationAttempts.forEach((attempts, ip) => {
    if (now > attempts.resetTime) {
      registrationAttempts.delete(ip);
    }
  });
}, CLEANUP_INTERVAL);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // Prevent unbounded growth
  if (registrationAttempts.size > MAX_ENTRIES) {
    // Remove oldest entries
    const entries = Array.from(registrationAttempts.entries());
    entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
    entries.slice(0, Math.floor(MAX_ENTRIES / 2)).forEach(([ip]) => {
      registrationAttempts.delete(ip);
    });
  }
  const attempts = registrationAttempts.get(ip);

  if (!attempts || now > attempts.resetTime) {
    registrationAttempts.set(ip, { count: 1, resetTime: now + 60 * 60 * 1000 }); // 1 hour window
    return true;
  }

  if (attempts.count >= 3) {
    // Max 3 registrations per hour per IP
    return false;
  }

  attempts.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check - improved IP extraction
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor
      ? forwardedFor.split(",")[0].trim() // Get first IP if multiple
      : request.headers.get("x-real-ip") ||
        "unknown";
    if (!checkRateLimit(ip)) {
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
