import { processQueuedImports } from "./lib/importProcessor";

async function testImportProcessing() {
  console.log("=== TESTING IMPORT PROCESSING ===\n");

  try {
    // Process with batch size of 50 to test multiple batches
    await processQueuedImports(50);

    console.log("\n=== IMPORT PROCESSING COMPLETED ===");
  } catch (error) {
    console.error("Error during import processing:", error);
  }
}

testImportProcessing();
