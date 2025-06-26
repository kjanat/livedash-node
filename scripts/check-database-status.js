// Check current database status
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  try {
    console.log('📊 Checking database status...\n');

    // Count total sessions
    const totalSessions = await prisma.session.count();
    console.log(`📈 Total sessions: ${totalSessions}`);

    // Count processed vs unprocessed
    const processedSessions = await prisma.session.count({
      where: { processed: true }
    });
    const unprocessedSessions = await prisma.session.count({
      where: { processed: false }
    });

    console.log(`✅ Processed sessions: ${processedSessions}`);
    console.log(`⏳ Unprocessed sessions: ${unprocessedSessions}`);

    // Count valid vs invalid data
    const validSessions = await prisma.session.count({
      where: { validData: true }
    });
    const invalidSessions = await prisma.session.count({
      where: { validData: false }
    });

    console.log(`🎯 Valid data sessions: ${validSessions}`);
    console.log(`❌ Invalid data sessions: ${invalidSessions}`);

    // Count sessions with messages
    const sessionsWithMessages = await prisma.session.count({
      where: {
        messages: {
          some: {}
        }
      }
    });

    console.log(`💬 Sessions with messages: ${sessionsWithMessages}`);

    // Count companies
    const totalCompanies = await prisma.company.count();
    console.log(`🏢 Total companies: ${totalCompanies}`);

    if (totalSessions === 0) {
      console.log('\n💡 No sessions found. Run CSV refresh to import data:');
      console.log('   curl -X POST http://localhost:3000/api/admin/refresh-sessions');
    }

  } catch (error) {
    console.error('❌ Error checking database status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkDatabaseStatus();
