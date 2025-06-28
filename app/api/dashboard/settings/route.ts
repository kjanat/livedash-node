import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "../../../../lib/prisma";
import { authOptions } from "../../../../lib/auth";

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
  const { csvUrl, csvUsername, csvPassword, sentimentThreshold } = body;

  await prisma.company.update({
    where: { id: user.companyId },
    data: {
      csvUrl,
      csvUsername,
      ...(csvPassword ? { csvPassword } : {}),
      // Remove sentimentAlert field - not in current schema
    },
  });

  return NextResponse.json({ ok: true });
}
