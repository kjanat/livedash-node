import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";
import { authOptions } from "../../auth/[...nextauth]/route";

interface UserBasicInfo {
  id: string;
  email: string;
  role: string;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
  });

  if (!user) {
    return NextResponse.json({ error: "No user" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { companyId: user.companyId },
  });

  const mappedUsers: UserBasicInfo[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
  }));

  return NextResponse.json({ users: mappedUsers });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
  });

  if (!user) {
    return NextResponse.json({ error: "No user" }, { status: 401 });
  }

  const body = await request.json();
  const { email, role } = body;

  if (!email || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email exists" }, { status: 409 });
  }

  const tempPassword = crypto.randomBytes(12).toString("base64").slice(0, 12); // secure random initial password

  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(tempPassword, 10),
      companyId: user.companyId,
      role,
    },
  });

  // TODO: Email user their temp password (stub, for demo) - Implement a robust and secure email sending mechanism. Consider using a transactional email service.
  return NextResponse.json({ ok: true, tempPassword });
}
