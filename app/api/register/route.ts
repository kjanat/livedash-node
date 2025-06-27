import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

interface RegisterRequestBody {
  email: string;
  password: string;
  company: string;
  csvUrl?: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, company, csvUrl } = body as RegisterRequestBody;

  if (!email || !password || !company) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required fields",
      },
      { status: 400 }
    );
  }

  // Check if email exists
  const exists = await prisma.user.findUnique({
    where: { email },
  });

  if (exists) {
    return NextResponse.json(
      {
        success: false,
        error: "Email already exists",
      },
      { status: 409 }
    );
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
      role: "ADMIN",
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: { success: true },
    },
    { status: 201 }
  );
}
