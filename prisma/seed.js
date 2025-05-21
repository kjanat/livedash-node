// seed.js - Create initial admin user and company
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create a company
  const company = await prisma.company.create({
    data: {
      name: 'Demo Company',
      csvUrl: 'https://example.com/data.csv', // Replace with a real URL if available
    }
  });

  // Create an admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'admin',
      companyId: company.id
    }
  });

  console.log('Seed data created successfully:');
  console.log('Company: Demo Company');
  console.log('Admin user: admin@demo.com (password: admin123)');
}

main()
  .catch(e => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
