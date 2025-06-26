import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });
    
    if (existingUser) {
      console.log('✅ User already exists:', existingUser.email);
      console.log('Password hash:', existingUser.password);
      return;
    }
    
    // First, ensure we have a company
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Demo Company',
          csvUrl: 'https://example.com/demo.csv',
        }
      });
      console.log('✅ Created demo company:', company.name);
    }
    
    // Create user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        companyId: company.id,
      }
    });
    
    console.log('✅ User created successfully:', user.email);
    console.log('Password hash:', user.password);
    console.log('Role:', user.role);
    console.log('Company:', company.name);
  } catch (error) {
    console.error('❌ Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
