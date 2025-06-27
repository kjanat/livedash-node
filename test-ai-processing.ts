import { processUnprocessedSessions } from "./lib/processingScheduler";

async function testAIProcessing() {
  console.log("=== TESTING AI PROCESSING ===\n");

  try {
    // Process with batch size of 10 to test multiple batches (since we have 109 sessions)
    await processUnprocessedSessions(10, 3); // batch size 10, max concurrency 3

    console.log("\n=== AI PROCESSING COMPLETED ===");
  } catch (error) {
    console.error("Error during AI processing:", error);
  }
}

testAIProcessing();
