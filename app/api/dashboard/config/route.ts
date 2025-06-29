import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
  });

  if (!user) {
    return NextResponse.json({ error: "No user" }, { status: 401 });
  }

  // Get company data
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });

  return NextResponse.json({ company });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email as string },
  });

  if (!user) {
    return NextResponse.json({ error: "No user" }, { status: 401 });
  }

  const body = await request.json();
  const { csvUrl } = body;

  await prisma.company.update({
    where: { id: user.companyId },
    data: { csvUrl },
  });

  return NextResponse.json({ ok: true });
}
