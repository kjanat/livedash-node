// Direct processing trigger without authentication
import { processUnprocessedSessions } from '../lib/processingScheduler.ts';

async function triggerProcessing() {
  try {
    console.log('🤖 Starting complete batch processing of all unprocessed sessions...\n');

    // Process all unprocessed sessions in batches until completion
    const result = await processUnprocessedSessions(10, 3);

    console.log('\n🎉 Complete processing finished!');
    console.log(`📊 Final results: ${result.totalProcessed} processed, ${result.totalFailed} failed`);
    console.log(`⏱️ Total time: ${result.totalTime.toFixed(2)}s`);

  } catch (error) {
    console.error('❌ Error during processing:', error);
  }
}

// Run the script
triggerProcessing();
