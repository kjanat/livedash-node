// seed.ts - Create initial admin user, company, and AI models
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🌱 Starting database seeding...");

    // Create the Jumbo company
    const company = await prisma.company.create({
      data: {
        name: "Jumbo Bas Bobbeldijk",
        csvUrl: "https://proto.notso.ai/jumbo/chats",
        csvUsername: "jumboadmin",
        csvPassword: "jumboadmin",
      },
    });
    console.log(`✅ Created company: ${company.name}`);

    // Create admin user
    const hashedPassword = await bcrypt.hash("8QbL26tB7fWS", 10);
    const adminUser = await prisma.user.create({
      data: {
        email: "max.kowalski.contact@gmail.com",
        password: hashedPassword,
        role: "ADMIN",
        companyId: company.id,
      },
    });
    console.log(`✅ Created admin user: ${adminUser.email}`);

    // Create AI Models
    const aiModels = [
      {
        name: "gpt-4o",
        provider: "openai",
        maxTokens: 128000,
        isActive: true,
      },
      {
        name: "gpt-4o-2024-08-06",
        provider: "openai",
        maxTokens: 128000,
        isActive: true,
      },
      {
        name: "gpt-4-turbo",
        provider: "openai",
        maxTokens: 128000,
        isActive: true,
      },
      {
        name: "gpt-4o-mini",
        provider: "openai",
        maxTokens: 128000,
        isActive: true,
      },
    ];

    const createdModels: any[] = [];
    for (const modelData of aiModels) {
      const model = await prisma.aIModel.create({
        data: modelData,
      });
      createdModels.push(model);
      console.log(`✅ Created AI model: ${model.name}`);
    }

    // Create current pricing for AI models (as of December 2024)
    const currentTime = new Date();
    const pricingData = [
      {
        modelName: "gpt-4o",
        promptTokenCost: 0.0000025,    // $2.50 per 1M tokens
        completionTokenCost: 0.00001,  // $10.00 per 1M tokens
      },
      {
        modelName: "gpt-4o-2024-08-06",
        promptTokenCost: 0.0000025,    // $2.50 per 1M tokens
        completionTokenCost: 0.00001,  // $10.00 per 1M tokens
      },
      {
        modelName: "gpt-4-turbo",
        promptTokenCost: 0.00001,      // $10.00 per 1M tokens
        completionTokenCost: 0.00003,  // $30.00 per 1M tokens
      },
      {
        modelName: "gpt-4o-mini",
        promptTokenCost: 0.00000015,   // $0.15 per 1M tokens
        completionTokenCost: 0.0000006, // $0.60 per 1M tokens
      },
    ];

    for (const pricing of pricingData) {
      const model = createdModels.find(m => m.name === pricing.modelName);
      if (model) {
        await prisma.aIModelPricing.create({
          data: {
            aiModelId: model.id,
            promptTokenCost: pricing.promptTokenCost,
            completionTokenCost: pricing.completionTokenCost,
            effectiveFrom: currentTime,
            effectiveUntil: null, // Current pricing
          },
        });
        console.log(`✅ Created pricing for: ${model.name}`);
      }
    }

    // Assign default AI model to company (gpt-4o)
    const defaultModel = createdModels.find(m => m.name === "gpt-4o");
    if (defaultModel) {
      await prisma.companyAIModel.create({
        data: {
          companyId: company.id,
          aiModelId: defaultModel.id,
          isDefault: true,
        },
      });
      console.log(`✅ Set default AI model for company: ${defaultModel.name}`);
    }

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`Company: ${company.name}`);
    console.log(`Admin user: ${adminUser.email}`);
    console.log(`Password: 8QbL26tB7fWS`);
    console.log(`AI Models: ${createdModels.length} models created with current pricing`);
    console.log(`Default model: ${defaultModel?.name}`);
    console.log("\n🚀 Ready to start importing CSV data!");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
