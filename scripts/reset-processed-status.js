// Reset all sessions to processed: false for reprocessing with new instructions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetProcessedStatus() {
  try {
    console.log('🔄 Resetting processed status for all sessions...');

    // Get count of currently processed sessions
    const processedCount = await prisma.session.count({
      where: { processed: true }
    });

    console.log(`📊 Found ${processedCount} processed sessions to reset`);

    if (processedCount === 0) {
      console.log('✅ No sessions need to be reset');
      return;
    }

    // Reset all sessions to processed: false
    const result = await prisma.session.updateMany({
      where: { processed: true },
      data: {
        processed: false,
        // Also reset AI-generated fields so they get fresh analysis
        sentimentCategory: null,
        category: null,
        questions: null,
        summary: null,
        validData: true // Reset to default
      }
    });

    console.log(`✅ Successfully reset ${result.count} sessions to processed: false`);
    console.log('🤖 These sessions will be reprocessed with the new OpenAI instructions');
    console.log('🎯 Quality validation will now mark invalid data appropriately');

  } catch (error) {
    console.error('❌ Error resetting processed status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetProcessedStatus();
