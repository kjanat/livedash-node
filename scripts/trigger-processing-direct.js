// Direct trigger for processing scheduler (bypasses authentication)
// Usage: node scripts/trigger-processing-direct.js

import { processUnprocessedSessions } from '../lib/processingScheduler.js';

async function triggerProcessing() {
  try {
    console.log('🚀 Manually triggering processing scheduler...\n');

    // Process with custom parameters
    await processUnprocessedSessions(50, 3); // Process 50 sessions with 3 concurrent workers

    console.log('\n✅ Processing trigger completed!');

  } catch (error) {
    console.error('❌ Error triggering processing:', error);
  }
}

triggerProcessing();
