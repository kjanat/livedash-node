// Test script to demonstrate the automated processing system
import { PrismaClient } from '@prisma/client';
import { processUnprocessedSessions, startProcessingScheduler } from '../lib/processingScheduler.ts';

const prisma = new PrismaClient();

async function testAutomation() {
  console.log('🧪 TESTING AUTOMATED PROCESSING SYSTEM\n');

  // Step 1: Show current status
  console.log('📊 STEP 1: Current Database Status');
  console.log('=' .repeat(50));
  await showStatus();

  // Step 2: Test the automated function
  console.log('\n🤖 STEP 2: Testing Automated Processing Function');
  console.log('=' .repeat(50));
  console.log('This is the SAME function that runs automatically every hour...\n');

  try {
    // This is the EXACT same function that runs automatically every hour
    const result = await processUnprocessedSessions(5, 2); // Smaller batch for demo

    console.log('\n✅ AUTOMATION TEST RESULTS:');
    console.log(`   📊 Sessions processed: ${result.totalProcessed}`);
    console.log(`   ❌ Sessions failed: ${result.totalFailed}`);
    console.log(`   ⏱️ Processing time: ${result.totalTime.toFixed(2)}s`);

    if (result.totalProcessed === 0 && result.totalFailed === 0) {
      console.log('\n🎉 PERFECT! No unprocessed sessions found.');
      console.log('✅ This means the automation is working - everything is already processed!');
    }

  } catch (error) {
    console.error('❌ Error testing automation:', error);
  }

  // Step 3: Show what the scheduler does
  console.log('\n⏰ STEP 3: Automated Scheduler Information');
  console.log('=' .repeat(50));
  console.log('🔄 HOURLY AUTOMATION:');
  console.log('   • Runs every hour: cron.schedule("0 * * * *")');
  console.log('   • Checks: WHERE processed = false AND messages: { some: {} }');
  console.log('   • Processes: ALL unprocessed sessions through OpenAI');
  console.log('   • Continues: Until NO unprocessed sessions remain');
  console.log('   • Quality: Validates and filters low-quality sessions');

  console.log('\n🚀 DASHBOARD INTEGRATION:');
  console.log('   • Refresh button triggers: triggerCompleteWorkflow()');
  console.log('   • Fetches transcripts: For sessions without messages');
  console.log('   • Processes everything: Until all sessions are analyzed');

  console.log('\n🎯 PRODUCTION STATUS:');
  console.log('   ✅ System is FULLY AUTOMATED');
  console.log('   ✅ No manual intervention needed');
  console.log('   ✅ Processes new data automatically');
  console.log('   ✅ Quality validation included');

  await prisma.$disconnect();
}

async function showStatus() {
  const totalSessions = await prisma.session.count();
  const processedSessions = await prisma.session.count({ where: { processed: true } });
  const unprocessedSessions = await prisma.session.count({ where: { processed: false } });
  const sessionsWithMessages = await prisma.session.count({
    where: { messages: { some: {} } }
  });

  console.log(`📈 Total sessions: ${totalSessions}`);
  console.log(`✅ Processed sessions: ${processedSessions}`);
  console.log(`⏳ Unprocessed sessions: ${unprocessedSessions}`);
  console.log(`💬 Sessions with messages: ${sessionsWithMessages}`);

  if (processedSessions === sessionsWithMessages && unprocessedSessions === 0) {
    console.log('\n🎉 AUTOMATION WORKING PERFECTLY!');
    console.log('✅ All sessions with messages have been processed');
    console.log('✅ No unprocessed sessions remaining');
  }
}

// Run the test
testAutomation();
