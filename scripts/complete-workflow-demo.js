// Complete workflow demonstration - Shows the full automated processing system
import { PrismaClient } from '@prisma/client';
import { processUnprocessedSessions } from '../lib/processingScheduler.ts';

const prisma = new PrismaClient();

async function demonstrateCompleteWorkflow() {
  try {
    console.log('🚀 COMPLETE AUTOMATED WORKFLOW DEMONSTRATION\n');

    // Step 1: Check initial status
    console.log('📊 STEP 1: Initial Database Status');
    console.log('=' .repeat(50));
    await checkDatabaseStatus();

    // Step 2: Fetch any missing transcripts
    console.log('\n📥 STEP 2: Fetching Missing Transcripts');
    console.log('=' .repeat(50));

    const sessionsWithoutMessages = await prisma.session.count({
      where: {
        messages: { none: {} },
        fullTranscriptUrl: { not: null }
      }
    });

    if (sessionsWithoutMessages > 0) {
      console.log(`Found ${sessionsWithoutMessages} sessions without messages but with transcript URLs`);
      console.log('💡 Run: node scripts/fetch-and-parse-transcripts.js');
    } else {
      console.log('✅ All sessions with transcript URLs already have messages');
    }

    // Step 3: Process all unprocessed sessions
    console.log('\n🤖 STEP 3: Complete AI Processing (All Unprocessed Sessions)');
    console.log('=' .repeat(50));

    const unprocessedCount = await prisma.session.count({
      where: {
        processed: false,
        messages: { some: {} }
      }
    });

    if (unprocessedCount > 0) {
      console.log(`Found ${unprocessedCount} unprocessed sessions with messages`);
      console.log('🔄 Starting complete batch processing...\n');

      const result = await processUnprocessedSessions(10, 3);

      console.log('\n🎉 Processing Results:');
      console.log(`   ✅ Successfully processed: ${result.totalProcessed}`);
      console.log(`   ❌ Failed to process: ${result.totalFailed}`);
      console.log(`   ⏱️ Total time: ${result.totalTime.toFixed(2)}s`);
    } else {
      console.log('✅ No unprocessed sessions found - all caught up!');
    }

    // Step 4: Final status
    console.log('\n📊 STEP 4: Final Database Status');
    console.log('=' .repeat(50));
    await checkDatabaseStatus();

    // Step 5: System summary
    console.log('\n🎯 STEP 5: Automated System Summary');
    console.log('=' .repeat(50));
    console.log('✅ HOURLY SCHEDULER: Processes new unprocessed sessions automatically');
    console.log('✅ DASHBOARD REFRESH: Triggers processing when refresh button is pressed');
    console.log('✅ BATCH PROCESSING: Processes ALL unprocessed sessions until completion');
    console.log('✅ QUALITY VALIDATION: Filters out low-quality sessions automatically');
    console.log('✅ COMPLETE AUTOMATION: No manual intervention needed for ongoing operations');

    console.log('\n🚀 SYSTEM READY FOR PRODUCTION!');

  } catch (error) {
    console.error('❌ Error in workflow demonstration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkDatabaseStatus() {
  const totalSessions = await prisma.session.count();
  const processedSessions = await prisma.session.count({ where: { processed: true } });
  const unprocessedSessions = await prisma.session.count({ where: { processed: false } });
  const sessionsWithMessages = await prisma.session.count({
    where: { messages: { some: {} } }
  });
  const companies = await prisma.company.count();

  console.log(`📈 Total sessions: ${totalSessions}`);
  console.log(`✅ Processed sessions: ${processedSessions}`);
  console.log(`⏳ Unprocessed sessions: ${unprocessedSessions}`);
  console.log(`💬 Sessions with messages: ${sessionsWithMessages}`);
  console.log(`🏢 Total companies: ${companies}`);
}

// Run the demonstration
demonstrateCompleteWorkflow();
