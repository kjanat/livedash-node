import { PrismaClient, PlatformUserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Seeding platform users for Notso AI...");

  // Create initial platform admin user
  const adminPassword = await bcrypt.hash("NotsoAI2024!Admin", 12);

  const admin = await prisma.platformUser.upsert({
    where: { email: "admin@notso.ai" },
    update: {},
    create: {
      email: "admin@notso.ai",
      password: adminPassword,
      name: "Platform Administrator",
      role: PlatformUserRole.SUPER_ADMIN,
    },
  });

  console.log("✅ Created platform super admin:", admin.email);

  // Create support user
  const supportPassword = await bcrypt.hash("NotsoAI2024!Support", 12);

  const support = await prisma.platformUser.upsert({
    where: { email: "support@notso.ai" },
    update: {},
    create: {
      email: "support@notso.ai",
      password: supportPassword,
      name: "Support Team",
      role: PlatformUserRole.SUPPORT,
    },
  });

  console.log("✅ Created platform support user:", support.email);

  console.log("\n🔑 Platform Login Credentials:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Super Admin:");
  console.log("  Email: admin@notso.ai");
  console.log("  Password: NotsoAI2024!Admin");
  console.log("");
  console.log("Support:");
  console.log("  Email: support@notso.ai");
  console.log("  Password: NotsoAI2024!Support");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n🌐 Platform Access:");
  console.log("  Login: http://localhost:3000/platform/login");
  console.log("  Dashboard: http://localhost:3000/platform/dashboard");
}

main()
  .catch((e) => {
    console.error("❌ Platform seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
