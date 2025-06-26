// Complete processing workflow - Fetches transcripts AND processes everything
import { PrismaClient } from '@prisma/client';
import { processUnprocessedSessions } from '../lib/processingScheduler.ts';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

async function completeProcessingWorkflow() {
  try {
    console.log('🚀 COMPLETE PROCESSING WORKFLOW STARTED\n');

    // Step 1: Check initial status
    console.log('📊 STEP 1: Initial Status Check');
    console.log('=' .repeat(50));
    await checkStatus();

    // Step 2: Fetch missing transcripts
    console.log('\n📥 STEP 2: Fetching Missing Transcripts');
    console.log('=' .repeat(50));

    const sessionsWithoutMessages = await prisma.session.count({
      where: {
        messages: { none: {} },
        fullTranscriptUrl: { not: null }
      }
    });

    if (sessionsWithoutMessages > 0) {
      console.log(`🔍 Found ${sessionsWithoutMessages} sessions needing transcript fetch`);
      console.log('📥 Fetching transcripts...\n');

      try {
        const { stdout } = await execAsync('node scripts/fetch-and-parse-transcripts.js');
        console.log(stdout);
      } catch (error) {
        console.error('❌ Error fetching transcripts:', error);
      }
    } else {
      console.log('✅ All sessions with transcript URLs already have messages');
    }

    // Step 3: Process ALL unprocessed sessions
    console.log('\n🤖 STEP 3: AI Processing (Complete Batch Processing)');
    console.log('=' .repeat(50));

    const unprocessedWithMessages = await prisma.session.count({
      where: {
        processed: false,
        messages: { some: {} }
      }
    });

    if (unprocessedWithMessages > 0) {
      console.log(`🔄 Found ${unprocessedWithMessages} unprocessed sessions with messages`);
      console.log('🤖 Starting complete batch processing...\n');

      const result = await processUnprocessedSessions(10, 3);

      console.log('\n🎉 AI Processing Results:');
      console.log(`   ✅ Successfully processed: ${result.totalProcessed}`);
      console.log(`   ❌ Failed to process: ${result.totalFailed}`);
      console.log(`   ⏱️ Total time: ${result.totalTime.toFixed(2)}s`);
    } else {
      console.log('✅ No unprocessed sessions with messages found');
    }

    // Step 4: Continue fetching more transcripts if available
    console.log('\n🔄 STEP 4: Checking for More Transcripts');
    console.log('=' .repeat(50));

    const remainingWithoutMessages = await prisma.session.count({
      where: {
        messages: { none: {} },
        fullTranscriptUrl: { not: null }
      }
    });

    if (remainingWithoutMessages > 0) {
      console.log(`🔍 Found ${remainingWithoutMessages} more sessions needing transcripts`);
      console.log('📥 Fetching additional transcripts...\n');

      try {
        const { stdout } = await execAsync('node scripts/fetch-and-parse-transcripts.js');
        console.log(stdout);

        // Process the newly fetched sessions
        const newUnprocessed = await prisma.session.count({
          where: {
            processed: false,
            messages: { some: {} }
          }
        });

        if (newUnprocessed > 0) {
          console.log(`\n🤖 Processing ${newUnprocessed} newly fetched sessions...\n`);
          const result = await processUnprocessedSessions(10, 3);
          console.log(`✅ Additional processing: ${result.totalProcessed} processed, ${result.totalFailed} failed`);
        }

      } catch (error) {
        console.error('❌ Error fetching additional transcripts:', error);
      }
    } else {
      console.log('✅ No more sessions need transcript fetching');
    }

    // Step 5: Final status
    console.log('\n📊 STEP 5: Final Status');
    console.log('=' .repeat(50));
    await checkStatus();

    console.log('\n🎯 WORKFLOW COMPLETE!');
    console.log('✅ All available sessions have been processed');
    console.log('✅ System ready for new data');

  } catch (error) {
    console.error('❌ Error in complete workflow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function checkStatus() {
  const totalSessions = await prisma.session.count();
  const processedSessions = await prisma.session.count({ where: { processed: true } });
  const unprocessedSessions = await prisma.session.count({ where: { processed: false } });
  const sessionsWithMessages = await prisma.session.count({
    where: { messages: { some: {} } }
  });
  const sessionsWithoutMessages = await prisma.session.count({
    where: { messages: { none: {} } }
  });

  console.log(`📈 Total sessions: ${totalSessions}`);
  console.log(`✅ Processed sessions: ${processedSessions}`);
  console.log(`⏳ Unprocessed sessions: ${unprocessedSessions}`);
  console.log(`💬 Sessions with messages: ${sessionsWithMessages}`);
  console.log(`📄 Sessions without messages: ${sessionsWithoutMessages}`);
}

// Run the complete workflow
completeProcessingWorkflow();
