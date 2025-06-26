// Test the improved prompt on a few sessions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testImprovedPrompt() {
  console.log('🧪 TESTING IMPROVED QUESTION EXTRACTION PROMPT\n');

  // Reset a few sessions to test the new prompt
  console.log('📝 Resetting 5 sessions to test improved prompt...');

  const sessionsToReprocess = await prisma.session.findMany({
    where: {
      processed: true,
      questions: '[]'  // Sessions with empty questions
    },
    take: 5
  });

  if (sessionsToReprocess.length > 0) {
    // Reset these sessions to unprocessed
    await prisma.session.updateMany({
      where: {
        id: { in: sessionsToReprocess.map(s => s.id) }
      },
      data: {
        processed: false,
        questions: null,
        summary: null
      }
    });

    console.log(`✅ Reset ${sessionsToReprocess.length} sessions for reprocessing`);
    console.log('Session IDs:', sessionsToReprocess.map(s => s.id));

    console.log('\n🚀 Now run this command to test the improved prompt:');
    console.log('npx tsx scripts/trigger-processing-direct.js');
    console.log('\nThen check the results with:');
    console.log('npx tsx scripts/check-questions-issue.js');
  } else {
    console.log('❌ No sessions with empty questions found to reprocess');
  }

  await prisma.$disconnect();
}

testImprovedPrompt();
